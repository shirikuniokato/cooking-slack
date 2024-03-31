import bolt from "@slack/bolt";
const { App, AwsLambdaReceiver } = bolt;
import { addModal, createCookList } from "./type.mjs";
import { sql } from "@vercel/postgres";

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

    await sql`INSERT INTO cook(name, link, memo, is_cook) VALUES (${cookName}, ${cookLink}, ${cookMemo}, false)`;
    const { rows } =
      await sql`SELECT id, name FROM cook WHERE name = ${cookName} ORDER BY created_at DESC LIMIT 1;`;

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

export const handler = async (event, context) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context);
};
