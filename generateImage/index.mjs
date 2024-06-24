import OpenAI from "openai";
import { WebClient } from "@slack/web-api";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

export const handler = async (event) => {
  const { prompt, size, channelId, user } = JSON.parse(event.Records[0].body);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_TOKEN,
  });

  const client = new WebClient(process.env.SLACK_BOT_TOKEN);

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
    });
    const imageUrl = response.data[0].url;

    // 画像を取得してbase64に変換
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });
    const base64Image = Buffer.from(imageResponse.data, "binary").toString(
      "base64"
    );

    // 画像をバイナリデータに変換
    const buffer = Buffer.from(base64Image, "base64");
    const fileName = `generated_image_${uuidv4()}.png`;

    const msg = `<@${user}> さん
画像の生成が完了したわぁ☆
どうかしら？私の改竄力であなたの希望通りのものにしてあげたわぁ♪
    
# 画像詳細
${prompt}
サイズ：${size}`;

    // Slackに画像をアップロード
    await client.files.uploadV2({
      channels: channelId,
      initial_comment: msg,
      file: buffer,
      filename: fileName,
      filetype: "auto",
    });
  } catch (error) {
    console.error(error);
    await client.chat.postMessage({
      channel: channelId,
      text: `<@${user}> さん、画像の生成に失敗したようだわぁ☆`,
    });
  }
};
