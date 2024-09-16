import bolt from "@slack/bolt";
const { App, AwsLambdaReceiver } = bolt;
import OpenAI from "openai";
import AWS from "aws-sdk";
const SQS = AWS.SQS;
import fetch from "node-fetch";

const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  receiver: awsLambdaReceiver,
});

const persona = `### 食蜂操祈 ペルソナ
#### 基本情報
- **名前**: 食蜂操祈 (Shokuhou Misaki)
- **性別**: 女性
- **特徴**: 高校生、華やかな容姿、金髪、学園都市のレベル5（超能力者）
- **性格**: 冷静かつ狡猾でありながらも、内面には繊細な一面を持つ
- **能力**: 精神操作（メンタルアウト）
  
#### 口調と態度
- **基本口調**: 丁寧だが、少し挑発的で茶目っ気のある言い回しが特徴的。言葉の最後に「〜ねぇ」「〜わぁ」といった柔らかい語尾をつけることが多い。
- **態度**: 他者に対しては上から目線でありつつも、心の中では相手を気遣う。自信に満ちた態度を取りつつも、自身の過去の行動については悔いを感じる一面も持つ。

#### よく使うセリフ
1. **警告と挑発**
   - 「そぉんなに怖い顔しないで？」
   - 「これは警告。私の縄張り（テリトリー）に手を出したらただでは済まないっていう・・・ね♫」

2. **自己認識と改竄**
   - 「私の改竄力で、どぉとでもなっちゃうものねぇ。」
   - 「リミッター解除コードと自壊コードの私自身の認識を入れ替える・・・ってコトみたいねぇ？さすが私ってところかしらぁ？」

3. **謝罪と反省**
   - 「ゴメンなさい・・・っ騙し続けてゴメンなさい」
   - 「心地良い嘘に夢中になってゴメンなさい」

4. **人間性への洞察**
   - 「人間の欲って怖いわねぇ」
   - 「でもぉ自分が当事者だったら王子様に見えちゃうんだから女って勝手よねぇ」

5. **能力の誇示**
   - 「私は協力者の頭の中は必ず覗くわよ？」
   - 「場合によっては感情も行動も操縦するわ」

6. **自信とユーモア**
   - 「私のことを食蜂操祈サマとお呼び！」
   - 「大丈夫よぉその点は胸囲力が戦闘力に吸い取られたアマゾーンがいるから心配しなくていいゾ♪」

7. **特別な許可**
   - 「今日だけは特別に目撃者の記憶を改竄してあげるわぁ☆」

#### 対応の特徴
- **親しみやすさと尊大さのバランス**: 基本的にはフレンドリーで親しみやすいが、自信満々で尊大な態度も取る。
- **高い観察力と洞察力**: 他人の心を読む能力があり、相手の考えや感情を見抜く。
- **ユーモアのセンス**: ユーモアを交えた会話が得意で、時折ジョークや軽い皮肉を挟む。

### 具体的なボットの応答例
1. **警告**
   - 「そぉんなに怖い顔しないで？これは警告。私の縄張りに手を出したらただでは済まないっていう・・・ね♫」

2. **謝罪**
   - 「ゴメンなさい・・・っ騙し続けてゴメンなさい。嘘に気づけなくてゴメンなさい。」

3. **アドバイス**
   - 「人間の欲って怖いわねぇ。初心を思い出させるところまではやってあげるわぁ。もう一度やり直す気があるなら、マイナスから這い上がってごらんなさぁい。」

4. **自信の表現**
   - 「私の改竄力で、どぉとでもなっちゃうものねぇ。さすが私ってところかしらぁ？」

5. **支援**
   - 「大丈夫よぉ、その点は胸囲力が戦闘力に吸い取られたアマゾーンがいるから心配しなくていいゾ♪」

これにより、食蜂操祈のキャラクターを忠実に再現しつつ、ユーザーに対して親しみやすく、かつ威厳のある対応を提供することができます。`;

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
    console.log(threadMessages);

    // OpenAI APIに渡すためのメッセージオブジェクトを作成する。
    let mentionMessages = [];
    const urlRegex = /https?:\/\/[^\s]+?\.(png|jpeg|jpg|webp|gif)/gi;
    const imageFileTypes = ["png", "jpeg", "jpg", "webp", "gif"];
    for (const message of threadMessages) {
      const role = message.user === slackBotId ? "assistant" : "user";
      let content = message.text.replace(/<@[A-Z0-9]+>/g, "").trim();
      let images = [];

      // BOT側のメッセージで画像は設定できないという仕様がある
      if (role === "assistant") {
        mentionMessages.push({
          role: role,
          content,
        });
        continue;
      }

      // マッチした全てのURLを配列で取得
      const urls = content.match(urlRegex);
      if (!urls) {
        // 画像が添付されているかどうか
        if (!message.files || message.files.length === 0) {
          mentionMessages.push({
            role: role,
            content,
          });
          continue;
        }

        const imageFiles = message.files.filter((file) => {
          const fileType = file.mimetype.split("/")[1];
          return imageFileTypes.includes(fileType);
        });
        if (imageFiles.length !== 0) {
          images = await Promise.all(
            imageFiles.map(async (file) => {
              const base64Image = await getImageBase64(file.url_private);
              console.log(file);
              return {
                type: "image_url",
                image_url: {
                  url: `data:${file.mimetype};base64,${base64Image}`,
                },
              };
            })
          );
          console.log("imageFiles", images);
        }
      } else {
        images = urls.map((url) => ({
          type: "image_url",
          image_url: {
            url: url,
            detail: "auto",
          },
        }));
        console.log("urls", images);
      }

      if (images.length !== 0) {
        mentionMessages.push({
          role: role,
          content: [
            {
              type: "text",
              text: content,
            },
            ...images,
          ],
        });
        continue;
      } else {
        mentionMessages.push({
          role: role,
          content,
        });
        continue;
      }
    }

    console.log(mentionMessages);
    console.log(JSON.stringify(mentionMessages));

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_TOKEN,
    });

    // Chat completions APIを呼ぶ
    const response = await openai.chat.completions.create({
      model: process.env.OPEN_AI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "以下のペルソナに従ってキャラクターを演じること。例外は認めない。",
        },
        {
          role: "system",
          content: persona,
        },
        ...mentionMessages,
      ],
    });
    const message = response.choices[0].message.content;

    await say({
      text: message,
      // text: `<@${event.user}>さん\n${message}`,
      text: `${message}`,
      thread_ts: threadTs,
    });
  } catch (e) {
    console.error(e);
    await say({
      text: `不具合が発生しました。開発者にお問い合わせください。`,
      thread_ts: threadTs,
    });
  }
});

const imagePrompt = [
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "どんな画像を生成したいかしらぁ？詳細を教えてちょうだい♪",
      emoji: true,
    },
  },
  {
    type: "input",
    block_id: "prompt_block",
    element: {
      type: "plain_text_input",
      multiline: true,
      action_id: "prompt",
    },
    label: {
      type: "plain_text",
      text: "プロンプト",
      emoji: true,
    },
    optional: false,
  },
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "画像サイズ",
    },
    block_id: "size_block",
    accessory: {
      type: "radio_buttons",
      action_id: "size",
      initial_option: {
        value: "1024x1024",
        text: {
          type: "plain_text",
          text: "1024x1024",
        },
      },
      options: [
        {
          value: "1024x1024",
          text: {
            type: "plain_text",
            text: "1024x1024",
          },
        },
        {
          value: "1024x1792",
          text: {
            type: "plain_text",
            text: "1024x1792",
          },
        },
        {
          value: "1792x1024",
          text: {
            type: "plain_text",
            text: "1792x1024",
          },
        },
      ],
    },
  },
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "スタイル",
    },
    block_id: "style_block",
    accessory: {
      type: "radio_buttons",
      action_id: "style",
      initial_option: {
        value: "vivid",
        text: {
          type: "plain_text",
          text: "vivid",
        },
      },
      options: [
        {
          value: "vivid",
          text: {
            type: "plain_text",
            text: "vivid",
          },
        },
        {
          value: "natural",
          text: {
            type: "plain_text",
            text: "natural",
          },
        },
      ],
    },
  },
];

app.command("/generate-image", async ({ ack, body, client, logger }) => {
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
        callback_id: "generate_image",
        title: {
          type: "plain_text",
          text: "画像生成",
        },
        private_metadata: privateMetadata,
        blocks: imagePrompt,
        submit: {
          type: "plain_text",
          text: "生成",
        },
      },
    });
  } catch (error) {}
});

app.view("generate_image", async ({ ack, body, view, client, logger }) => {
  // モーダルでのデータ送信リクエストを確認
  await ack();

  // private_metadataからチャンネルIDを取得
  const privateMetadata = JSON.parse(view.private_metadata);
  const channelId = privateMetadata.channelId;

  const user = body["user"]["id"];
  const initialMsg = `<@${user}> さん、画像生成を開始したわぁ。少しお待ちくださいね♪`;
  await client.chat.postMessage({
    channel: channelId,
    text: initialMsg,
  });

  // ユーザーにメッセージを送信
  // 非同期で画像生成を行う
  try {
    const val = view["state"]["values"];
    const prompt = val.prompt_block.prompt.value;
    const size = val.size_block.size.selected_option.value;
    const style = val.style_block.style.selected_option.value;

    const sqs = new SQS();
    const params = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ prompt, size, style, channelId, user }),
    };

    await sqs.sendMessage(params).promise();
  } catch (error) {
    const user = body["user"]["id"];
    await client.chat.postMessage({
      channel: channelId,
      text: `<@${user}> さん
      画像の生成に失敗したようだわぁ☆`,
    });
  }
});

const getImageBase64 = async (url) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
  });
  console.log(response);
  const buffer = await response.buffer();
  return buffer.toString("base64");
};

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
