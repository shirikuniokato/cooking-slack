import bolt from "@slack/bolt";
const { App, AwsLambdaReceiver } = bolt;
import { sql } from "@vercel/postgres";

// AWS Lambda Receiverのセットアップ
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Slackアプリのセットアップ
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  receiver: awsLambdaReceiver,
});

// メッセージが #hololive-notify に投稿されたときのイベントリスナー
app.event("message", async ({ event, client, logger }) => {
  // IFTTTボットからのメッセージかどうかを確認
  if (
    event.channel === process.env.NOTIFY_CHANNEL_ID &&
    event.bot_id &&
    event.bot_id === process.env.IFTTT_BOT_ID
  ) {
    try {
      // メッセージからuser_idを抽出（@付きのTwitter ID）
      for (const attachment of event.attachments) {
        const twitterId = extractUserIdFromText(attachment.pretext);
        if (!twitterId) {
          logger.info("User ID could not be extracted from message.");
          return;
        }

        // twitter_channel_mapping テーブルから該当するSlackチャンネルを取得
        const { rows: usersToNotify } = await sql`
        SELECT channel_id FROM twitter_channel_mapping WHERE twitter_id = ${twitterId};
        `;
        // 該当するSlackチャンネルにメッセージを転送
        for (const user of usersToNotify) {
          // チャンネル削除などで送信失敗した場合は握りつぶす
          try {
            await client.chat.postMessage({
              channel: user.channel_id,
              text: attachment.pretext, // オリジナルのメッセージをそのまま転送
            });
          } catch (e) {
            console.error("Error fowarding message: ", e, user.channel_id);
            continue;
          }
        }
      }
    } catch (error) {
      logger.error("Error forwarding message: ", error);
      console.error(event);
    }
  }
});

// メッセージからuser_idを抽出する関数（フォーマット: @hiodoshaio）
function extractUserIdFromText(text) {
  const match = text.match(/@(\w+)/); // メッセージ内の @twitter_id を抽出
  return match ? match[1] : null;
}

app.command("/hololive-notify", async ({ ack, body, client, logger }) => {
  await ack();
  const message =
    "ホロメンのツイート転送設定方法！ \n\n" +
    "以下のスプレッドシートから転送設定を行なってください\n" +
    "1. 雛形シートをコピーする\n" +
    "2. チャンネル名、作成者を入力する\n" +
    "3. ツイート転送を行うホロメンをホロメン一覧シートから転記する（分類同期で一括転記も可能）\n" +
    "4. 設定反映ボタンを押下する\n\n" +
    "LINK:https://docs.google.com/spreadsheets/d/1RDWudhyaifU5SM3PYAD8utq3T5mY1MzpPanPWWkf0hA/edit?gid=1679424553#gid=1679424553";
  await client.chat.postMessage({
    channel: body.channel_id,
    text: message,
  });
});

// AWS Lambdaハンドラー
export const handler = async (event, context) => {
  // Slack再送イベントのチェック
  if (event.headers["x-slack-retry-num"]) {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "No need to resend" }),
    };
  }

  try {
    // Lambda Receiverの実行
    const handler = await awsLambdaReceiver.start();
    return handler(event, context);
  } catch (error) {
    console.error("Error starting Slack event listener:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
