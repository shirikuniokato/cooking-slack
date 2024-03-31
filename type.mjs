export const addModal = [
  {
    type: "section",
    text: {
      type: "plain_text",
      text: "西岡の料理力向上にご協力ください！リクエストお待ちしております。",
      emoji: true,
    },
  },
  {
    type: "input",
    block_id: "name_block",
    element: {
      type: "plain_text_input",
      action_id: "cook_name",
    },
    label: {
      type: "plain_text",
      text: "料理名",
      emoji: true,
    },
  },
  {
    type: "input",
    block_id: "link_block",
    element: {
      type: "plain_text_input",
      action_id: "cook_link",
    },
    label: {
      type: "plain_text",
      text: "リンク",
      emoji: true,
    },
    optional: true,
  },
  {
    type: "input",
    block_id: "memo_block",
    element: {
      type: "plain_text_input",
      multiline: true,
      action_id: "cook_note",
    },
    label: {
      type: "plain_text",
      text: "備考",
      emoji: true,
    },
    optional: true,
  },
];

export const createCookList = (cooks) => {
  let links = [];
  for (const cook of cooks) {
    const emoji = cook.is_cook ? ":white_check_mark:" : ":x:";
    links.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} ${cook.name}`,
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "詳細",
          emoji: true,
        },
        value: "click_me_123",
        url: `https://cook.nishioka-app.com/item/${cook.id}`,
        action_id: "button-action",
      },
    });
  }

  const result = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "一覧",
        emoji: true,
      },
    },
    ...links,
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<https://cook.nishioka-app.com|もっと見る>`,
      },
    },
  ];
  return result;
};
