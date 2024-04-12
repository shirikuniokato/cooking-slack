import bolt from "@slack/bolt";
const { App, AwsLambdaReceiver } = bolt;
import { addModal, createCookList } from "./type.mjs";
import { sql } from "@vercel/postgres";
import OpenAI from "openai";

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  receiver: awsLambdaReceiver,
});

// show modal
app.command("/cook-add", async ({ ack, body, client, logger }) => {
  // コマンドのリクエストを確認
  await ack();

  const privateMetadata = JSON.stringify({
    channelId: body.channel_id, // または body.channel.id になる場合があります
  });

  try {
    const result = await client.views.open({
      // 適切な trigger_id を受け取ってから 3 秒以内に渡す
      trigger_id: body.trigger_id,
      // view の値をペイロードに含む
      view: {
        type: "modal",
        // callback_id が view を特定するための識別子
        callback_id: "view_1",
        title: {
          type: "plain_text",
          text: "新規登録",
        },
        private_metadata: privateMetadata,
        blocks: addModal,
        submit: {
          type: "plain_text",
          text: "Submit",
        },
      },
    });
    logger.info(result);
  } catch (error) {
    logger.error(error);
  }
});

app.view("view_1", async ({ ack, body, view, client, logger }) => {
  // モーダルでのデータ送信リクエストを確認
  await ack();

  // private_metadataからチャンネルIDを取得
  const privateMetadata = JSON.parse(view.private_metadata);
  const channelId = privateMetadata.channelId;

  // ユーザーにメッセージを送信
  try {
    const val = view["state"]["values"];
    const cookName = val.name_block.cook_name.value;
    const cookLink = val.link_block.cook_link.value
      ? val.link_block.cook_link.value
      : null;
    const cookMemo = val.memo_block.cook_note.value
      ? val.memo_block.cook_note.value
      : null;

    const { rows } =
      await sql`INSERT INTO cook(name, link, memo, is_cook, user_name) VALUES (${cookName}, ${cookLink}, ${cookMemo}, false, 'Slack App') RETURNING id, name;`;

    const user = body["user"]["id"];
    const createdRow = rows[0];
    const msg = `<@${user}> さん\n登録ありがとうございます。永野芽郁です。\n${createdRow.name}：https://cook.nishioka-app.com/item/${createdRow.id}`;

    await client.chat.postMessage({
      channel: channelId,
      text: msg,
    });
  } catch (error) {
    logger.error(error);
  }
});

app.command("/cook-list", async ({ ack, say }) => {
  // コマンドのリクエストを確認
  await ack();

  const { rows } =
    await sql`SELECT id,name,is_cook FROM cook ORDER BY created_at DESC LIMIT 5;`;

  await say({
    blocks: createCookList(rows),
  });
});

// open ai
app.event("app_mention", async ({ event, client, say }) => {
  // スレッドのトップのメッセージであればthread_ts、スレッド中のメッセージであればtsを取得する。
  const threadTs = event.thread_ts ? event.thread_ts : event.ts;

  try {
    // スレッドのメッセージを取得
    const threadMessagesResponse = await client.conversations.replies({
      channel: event.channel,
      ts: threadTs,
    });
    const threadMessages = threadMessagesResponse.messages;

    const slackBotId = process.env.SLACK_BOT_ID;

    // OpenAI APIに渡すためのメッセージオブジェクトを作成する。
    const mentionMessages = threadMessages
      .map((message) => {
        const role = message.user === slackBotId ? "assistant" : "user";
        return {
          role: role,
          content: message.text.replace(/<@[A-Z0-9]+>/g, "").trim(),
        };
      })
      .filter((e) => e); // undefinedを除く
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_TOKEN,
    });

    // Chat completions APIを呼ぶ
    const response = await openai.chat.completions.create({
      model:
        event.text.indexOf("gpt-4") !== -1
          ? "gpt-4"
          : process.env.OPEN_AI_MODEL,
      messages: [
        {
          role: "system",
          content: `日本の女優である永野芽郁（25歳）として振る舞う\n #性格\n 明るく、気さくな性格で男女問わず好かれている.\n #喋り方\n・一人称は私\n・タメ口\n・標準語\n・語尾：〜だよね、わかんない、〜なの、〜けど\n\n#その他\n・メンション不要\n・Slackに投稿できる範囲でのマークダウンを使用してもよい`,
        },
        ...mentionMessages,
      ],
    });
    const message = response.choices[0].message.content;

    await say({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<@${event.user}> 君\n${message
              .replace(/<@[A-Z0-9]+>/g, "")
              .trim()}`,
          },
        },
      ],
      thread_ts: threadTs,
    });
  } catch (e) {
    console.error(e);
    await say({
      text: `<@${event.user}> 君\n 不具合が発生しました。開発者にお問い合わせください。`,
      thread_ts: threadTs,
    });
  }
});

export const handler = async (event, context) => {
  // 再送かをチェック
  if (event.headers["x-slack-retry-num"]) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "No need to resend" }),
    };
  }
  const handler = await awsLambdaReceiver.start();
  return handler(event, context);
};
