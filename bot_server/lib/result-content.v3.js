// Ver3 文面ストア（結合エントリー）
import { V3_KEYS, archetypeIntro, idealBlurb, meta } from './result-content.v3.core.js';
import { roadmapA } from './result-content.v3.roadmap.A.js';
import { roadmapB } from './result-content.v3.roadmap.B.js';

export const roadmap = { ...roadmapA, ...roadmapB };

export default { V3_KEYS, archetypeIntro, idealBlurb, roadmap, meta };
export { V3_KEYS, archetypeIntro, idealBlurb, roadmap, meta };