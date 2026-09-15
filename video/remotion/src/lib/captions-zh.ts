import type { Cue } from "../components/Captions";
import { withProject } from "./project";

/**
 * 中文版字幕与旁白（完整版 3:52），时间与英文版 captions.ts 一一对应。旁白用云扬（zh-CN-YunyangNeural）：
 *   CAPTIONS_FILE=captions-zh.ts NARRATOR_VOICE=zh-CN-YunyangNeural VO_TAG=yunyang node video/music/make-narration.mjs
 * 云扬每秒约 3.6 字（变速上限 1.25 倍 ≈ 4.5 字），每句按窗口控制字数。用语：writer agent = 作家智能体，
 * character agents = 角色智能体。玩家打的字由旁白转述；角色原声（Vera 日语、Elias 英语）保留，只配字幕。
 */
const RAW_ZH: Cue[] = [
  { from: 0.4, to: 3.8, text: "故事，一直都是一个个世界。" },
  { from: 4.2, to: 6.8, text: "书，让我们读它。" },
  { from: 7.2, to: 9.8, text: "游戏，让我们玩它。" },
  { from: 10.2, to: 13.8, text: "聊天机器人：一个角色，困在一个框里。" },
  { from: 14.3, to: 16.8, text: "但从没有人让你活在其中。" },
  { from: 19.3, to: 21.35, text: "这是 Worldlines：{PROJECT}。" },
  { from: 21.4, to: 27.4, text: "一张无限画布，你、角色智能体和作家智能体共享同一个世界。" },
  { from: 33.1, to: 34.9, text: "而且，他们会回话。" },
  // Elias 的英语原声（A3 结尾，13.27 录屏）。
  { from: 55.2, to: 58.9, speaker: "Elias", text: "慢慢说。不过在听到之前，我不会回办公室。" },
  { from: 59.3, to: 63.8, text: "选一个世界。" },
  // 雾坞镇，64–132 秒，全部来自 44 分钟实录（日文版界面）。
  { from: 64.3, to: 67.4, text: "雾坞镇：船只接连失踪，你接下委托。" },
  { from: 67.7, to: 72.3, text: "在港口搜寻线索。关键时刻，由骰子决定。" },
  { from: 72.6, to: 75.0, text: "玩家问 Vera 为什么要帮忙。" },
  { from: 75.3, to: 77.9, speaker: "Vera", text: "别以为我会无条件信任你。" },
  { from: 79.4, to: 85.8, speaker: "Vera", text: "只是不想让漏看的伤痕伤到别人——我得先弄清这零件是谁的。" },
  { from: 86.0, to: 91.1, text: "说出你的推理，作家智能体就把下一个地点写进世界。" },
  { from: 91.3, to: 93.7, text: "玩家邀请她同行。" },
  { from: 93.9, to: 95.6, speaker: "Vera", text: "当然，我跟你去。" },
  { from: 95.9, to: 99.6, text: "她跟上来，你们一起找到第二艘船。" },
  { from: 101.7, to: 103.9, text: "玩家发现了新的路。" },
  { from: 104.2, to: 105.4, speaker: "Vera", text: "第二艘船。" },
  { from: 105.5, to: 110.8, speaker: "Vera", text: "还没亲眼确认那艘船。不过，新的路是真的。" },
  { from: 111.0, to: 115.2, text: "深入之后，玩家问要不要回头。" },
  { from: 115.5, to: 117.5, speaker: "Vera", text: "换作是我，还不会回去。" },
  { from: 117.6, to: 125.5, speaker: "Vera", text: "木箱的擦痕，或没沾泥的车辙——查清其中一个，就离第二艘船更近了。" },
  // 用量截图是整个项目一周的，所以只说额度在这一局里用完，不说这一局花掉了全部。
  { from: 125.8, to: 131.8, text: "我们玩上了瘾：一局玩了44分钟，直到100美元额度用完。" },
  // 初雪，132–142 秒。
  { from: 132.3, to: 135.9, text: "初雪之夜，守住一个约定。" },
  { from: 138.3, to: 141.7, text: "结局，由你的选择写成。" },
  { from: 142.3, to: 146.8, text: "改变1994年的一个早晨，看看今晚谁还在。" },
  // Ryo 的日语原声：「鮭が跳ねるところ、また見たいな。」
  { from: 147.2, to: 150.9, speaker: "Ryo", text: "好想再看一次鲑鱼跃出水面。" },
  { from: 151.1, to: 153.8, text: "同一条街，前后对比。" },
  { from: 154.2, to: 156.6, text: "或者，只从一个约定开始。" },
  // 157.0–164.4 是 Lyra 的两句（A5 里的字幕）。
  { from: 164.6, to: 169.8, text: "答应她，作家智能体就在你走进去时写出下一个地方。" },
  { from: 170.3, to: 174.1, text: "每个角色，也都有自己的小天地。" },
  // 174.3–177.0 是 Vera 在心象空间里的一句（A5 里的字幕）。
  { from: 178.2, to: 181.8, text: "而且，它永远不会走到尽头。" },
  // GPT Live，182–200 秒：先讲功能，再放演示（Elias 从 185.6 秒开口）。
  { from: 182.2, to: 185.5, text: "用 GPT Live，和角色实时通话。" },
  { from: 192.1, to: 196.2, text: "通话里答应的事，会被写进世界。" },
  // 200–218 秒：先是已经做到的（作家智能体写代码），最后才是下一步（多人）。
  { from: 200.3, to: 204.8, text: "作家智能体会写剧情、规则，也会写代码。" },
  { from: 205.0, to: 209.5, text: "故事需要什么，它就能造出什么。" },
  { from: 210.3, to: 217.5, text: "下一步：拉上朋友，进入同一个故事。" },
  { from: 222.6, to: 225.8, text: "书让我们读，游戏让我们玩。" },
  { from: 226.6, to: 231.6, text: "而 Worldlines，让你和角色智能体一起活在世界里。" },
];
export const NARRATION_ZH: Cue[] = RAW_ZH.map((c) => ({ ...c, text: withProject(c.text) }));
