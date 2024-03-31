import bolt from "@slack/bolt";
const { App, AwsLambdaReceiver } = bolt;
import { addModal, createCookList } from "../type.mjs";
import { sql } from "@vercel/postgres";

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  receiver: awsLambdaReceiver,
});

// レコード登録日から 2週間経過している料理の進捗状況を確認する
const notify = async () => {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  const ymd = `${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()} 23:59`;

  // const {
  //   rows,
  // } = sql`SELECT id, name, created_at FROM cook WHERE is_cook = FALSE AND created_at <= ${ymd} ORDER BY created_at ASC;`;
  const { rows } =
    await sql`SELECT id, name, created_at FROM cook WHERE is_cook = FALSE ORDER BY created_at ASC;`;

  if (rows.length === 0) {
    return null;
  }

  // generate message
  let messages = [
    "永野芽郁です。まだ作っていない料理があるみたいですが状況いかがでしょうか。",
  ];
  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    const createYmd = `${createdAt.getFullYear()}-${
      createdAt.getMonth() + 1
    }-${createdAt.getDate()}`;
    messages.push(
      `${createYmd}：<https://cook.nishioka-app.com/item/${row.id}|${row.name}>`
    );
  }

  // send message
  // TODO called bolt channel お勉強改
  const sendMessage = messages.join("\n");
  const channelId = "C055ZG6BB7E";
  await app.client.chat.postMessage({
    token: process.env.SLACK_BOT_TOKEN,
    channel: channelId,
    text: sendMessage,
  });
};

// TODO 毎日 12:00 に kick (EventBridgh)
export const handler = async (event, context) => {
  const handler = await awsLambdaReceiver.start();
  await notify();
  return null;
};
