import { sql } from "@vercel/postgres";

exports.handler = async (event) => {
  const body = JSON.parse(event.body);

  const channelId = body.channel_id;
  const twitterIds = body.twitter_ids; // 複数のTwitter IDを配列で受け取る
  const secret = body.secret;

  if (
    secret !==
    "fpF/2hJcOXfCNVW7E1OaJx4SPHteHpCWsyFVLyivhhyT1+wf+eKNrpCJu1Mk+2PJ9lzm0jWrNcM+6DxfPoQjHVSrFnINgrUK/eAqhCuYUIS6ZEVfOkk9yjUdp0hBjS1Dq6HeKo1UrZx/myKHe8N9Dd7CCK2lmitIWc5WPYglVjeJU49EPCppWx1wBLYGpKuzlr+o2wTu0GxcKfirfTQYM6rtOFqQstxTE5IoYp85aJyPp3qwVmvGlxLj72aGRUMNJrYDgHDQImJ57ccDf/5rrh64r5bJ8IJOIQbMBnj1qcuzS1hF+MNfMey5IP144nsOvqEj2MUsU+uUorHlzS6rJg=="
  ) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: "Unauthorized" }),
    };
  }
  if (!channelId || !twitterIds || twitterIds.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid channel_id or twitter_ids" }),
    };
  }

  try {
    // 既存のTwitter IDを取得
    const { rows: existingEntries } = await sql`
      SELECT twitter_id FROM twitter_channel_mapping WHERE channel_id = ${channelId}
    `;
    const existingTwitterIds = existingEntries.map((row) => row.twitter_id);

    // 新しいTwitter IDを挿入
    const newTwitterIds = twitterIds.filter(
      (id) => !existingTwitterIds.includes(id)
    );
    if (newTwitterIds.length > 0) {
      for (const twitterId of newTwitterIds) {
        await sql`
          INSERT INTO twitter_channel_mapping (channel_id, twitter_id)
          VALUES (${channelId}, ${twitterId})
        `;
      }
    }

    // 削除すべきTwitter IDがあれば削除
    const twitterIdsToDelete = existingTwitterIds.filter(
      (id) => !twitterIds.includes(id)
    );
    if (twitterIdsToDelete.length > 0) {
      for (const twitterId of twitterIdsToDelete) {
        await sql`
          DELETE FROM twitter_channel_mapping WHERE channel_id = ${channelId} AND twitter_id = ${twitterId}
        `;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Data processed successfully" }),
    };
  } catch (err) {
    console.error("Database error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Error processing data" }),
    };
  }
};
