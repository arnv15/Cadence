import { Circle, Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

import { SceneFrame, type SceneProps } from '@/prompts/scene-frame';

/**
 * Scene 2 — an afternoon in the park with weather on the way.
 *
 * Describable content: the kite caught in the tree, the child on the swing, the man throwing
 * bread to the ducks, the pond, the rain clouds and the rain, the empty bench, the ball on the
 * grass, the flowers and the bird overhead.
 */
export function ParkScene({ width, style, testID }: SceneProps) {
  return (
    <SceneFrame
      width={width}
      style={style}
      testID={testID ?? 'scene-park'}
      label="Picture: a park">
      {/* Sky and grass */}
      <Rect x={0} y={0} width={400} height={212} fill="#BFE3F2" />
      <Rect x={0} y={206} width={400} height={94} fill="#7FA85C" />
      <Path d="M0 212 C 90 198 150 214 240 204 C 310 196 360 210 400 202 L400 216 L0 216 Z" fill="#6D9550" />

      {/* Fair-weather cloud */}
      <Ellipse cx={172} cy={36} rx={26} ry={14} fill="#FFFFFF" />
      <Ellipse cx={196} cy={30} rx={20} ry={16} fill="#FFFFFF" />

      {/* Rain clouds moving in */}
      <Ellipse cx={272} cy={48} rx={28} ry={16} fill="#9AA6B2" />
      <Ellipse cx={304} cy={38} rx={34} ry={21} fill="#8894A1" />
      <Ellipse cx={340} cy={50} rx={26} ry={15} fill="#9AA6B2" />
      <Line x1={278} y1={64} x2={271} y2={86} stroke="#6F8CA6" strokeWidth={4} strokeLinecap="round" />
      <Line x1={296} y1={62} x2={289} y2={88} stroke="#6F8CA6" strokeWidth={4} strokeLinecap="round" />
      <Line x1={314} y1={64} x2={307} y2={84} stroke="#6F8CA6" strokeWidth={4} strokeLinecap="round" />
      <Line x1={332} y1={62} x2={325} y2={88} stroke="#6F8CA6" strokeWidth={4} strokeLinecap="round" />
      <Line x1={350} y1={66} x2={343} y2={84} stroke="#6F8CA6" strokeWidth={4} strokeLinecap="round" />

      {/* Bird */}
      <Path
        d="M146 62 C 152 54 158 54 163 62 C 168 54 174 54 180 62"
        fill="none"
        stroke="#3A4A55"
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* Tree with a kite caught in it */}
      <Rect x={78} y={132} width={19} height={82} fill="#7A5433" />
      <Path d="M78 214 C 70 210 66 214 62 214 L113 214 C 108 212 104 208 97 214 Z" fill="#7A5433" />
      <Circle cx={58} cy={122} r={34} fill="#4F7B45" />
      <Circle cx={92} cy={102} r={41} fill="#5C8C50" />
      <Circle cx={122} cy={128} r={30} fill="#4F7B45" />
      <Circle cx={84} cy={140} r={26} fill="#5C8C50" />
      <Polygon points="120,74 137,96 120,118 103,96" fill="#E4913C" />
      <Line x1={120} y1={74} x2={120} y2={118} stroke="#8A3F28" strokeWidth={3} />
      <Line x1={103} y1={96} x2={137} y2={96} stroke="#8A3F28" strokeWidth={3} />
      <Path
        d="M120 118 C 132 128 118 136 130 146 C 142 154 132 162 142 170"
        fill="none"
        stroke="#8A3F28"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path d="M126 130 L136 126 M126 130 L130 140" stroke="#C25A3A" strokeWidth={3} strokeLinecap="round" />
      <Path d="M132 152 L142 148 M132 152 L136 162" stroke="#C25A3A" strokeWidth={3} strokeLinecap="round" />

      {/* Swing set with a child on the swing */}
      <Line x1={157} y1={216} x2={178} y2={138} stroke="#5E6A72" strokeWidth={8} strokeLinecap="round" />
      <Line x1={239} y1={216} x2={218} y2={138} stroke="#5E6A72" strokeWidth={8} strokeLinecap="round" />
      <Line x1={170} y1={138} x2={226} y2={138} stroke="#5E6A72" strokeWidth={8} strokeLinecap="round" />
      <Line x1={185} y1={140} x2={184} y2={190} stroke="#7A5433" strokeWidth={4} />
      <Line x1={208} y1={140} x2={209} y2={190} stroke="#7A5433" strokeWidth={4} />
      <Rect x={178} y={188} width={36} height={8} rx={3} fill="#7A5433" />
      <Path
        d="M196 192 L216 196 M196 192 L219 205"
        stroke="#3A5A7A"
        strokeWidth={9}
        strokeLinecap="round"
      />
      <Circle cx={221} cy={206} r={6} fill="#C25A3A" />
      <Circle cx={219} cy={197} r={6} fill="#C25A3A" />
      <Rect x={185} y={164} width={22} height={28} rx={8} fill="#D2553F" />
      <Path d="M188 172 L182 146 M204 172 L210 146" stroke="#F0C39A" strokeWidth={7} strokeLinecap="round" />
      <Circle cx={196} cy={152} r={12} fill="#F0C39A" />
      <Path d="M184 150 C 184 134 208 134 208 150 Z" fill="#D9A65C" />
      <Circle cx={192} cy={154} r={2.2} fill="#2B2118" />
      <Circle cx={201} cy={154} r={2.2} fill="#2B2118" />

      {/* Pond with ducks */}
      <Ellipse cx={334} cy={254} rx={64} ry={31} fill="#4F9DD1" />
      <Ellipse cx={334} cy={250} rx={52} ry={22} fill="#63AEDE" />
      <Path d="M296 266 C 306 260 316 272 326 266" fill="none" stroke="#3E85B4" strokeWidth={3} />
      <Path d="M340 274 C 350 268 360 280 370 274" fill="none" stroke="#3E85B4" strokeWidth={3} />
      <Ellipse cx={304} cy={244} rx={15} ry={9} fill="#F7F2E6" />
      <Circle cx={293} cy={236} r={7} fill="#F7F2E6" />
      <Polygon points="286,236 276,239 286,241" fill="#E4913C" />
      <Circle cx={291} cy={234} r={1.8} fill="#2B2118" />
      <Ellipse cx={344} cy={256} rx={16} ry={10} fill="#F7F2E6" />
      <Circle cx={332} cy={247} r={7} fill="#F7F2E6" />
      <Polygon points="325,247 315,250 325,252" fill="#E4913C" />
      <Circle cx={330} cy={245} r={1.8} fill="#2B2118" />
      <Ellipse cx={372} cy={240} rx={13} ry={8} fill="#E8DFCC" />
      <Circle cx={362} cy={233} r={6} fill="#E8DFCC" />
      <Polygon points="356,233 348,236 356,238" fill="#E4913C" />

      {/* Man throwing bread to the ducks */}
      <Rect x={246} y={210} width={11} height={40} fill="#3A4A6A" />
      <Rect x={261} y={210} width={11} height={40} fill="#33415E" />
      <Rect x={241} y={174} width={33} height={42} rx={10} fill="#5E7F6E" />
      <Rect x={230} y={190} width={15} height={19} rx={4} fill="#E8DFCC" />
      <Path d="M244 182 L232 192" stroke="#E8B98C" strokeWidth={9} strokeLinecap="round" />
      <Path d="M271 180 L292 170" stroke="#E8B98C" strokeWidth={9} strokeLinecap="round" />
      <Circle cx={257} cy={160} r={14} fill="#E8B98C" />
      <Path d="M244 158 C 244 142 270 142 270 158 Z" fill="#A6A6A6" />
      <Circle cx={252} cy={162} r={2.3} fill="#2B2118" />
      <Circle cx={262} cy={162} r={2.3} fill="#2B2118" />
      <Circle cx={300} cy={170} r={3.5} fill="#E8DFCC" />
      <Circle cx={312} cy={182} r={3.5} fill="#E8DFCC" />
      <Circle cx={322} cy={198} r={3} fill="#E8DFCC" />
      <Circle cx={329} cy={214} r={2.6} fill="#E8DFCC" />

      {/* Empty bench */}
      <Rect x={22} y={236} width={98} height={8} rx={2} fill="#A0713F" />
      <Rect x={22} y={248} width={98} height={7} rx={2} fill="#B58250" />
      <Rect x={16} y={258} width={110} height={9} rx={2} fill="#A0713F" />
      <Rect x={26} y={234} width={8} height={26} fill="#7A5433" />
      <Rect x={108} y={234} width={8} height={26} fill="#7A5433" />
      <Rect x={26} y={267} width={9} height={20} fill="#7A5433" />
      <Rect x={107} y={267} width={9} height={20} fill="#7A5433" />

      {/* Ball on the grass */}
      <Circle cx={162} cy={266} r={15} fill="#E4413C" />
      <Path d="M147 266 C 157 258 167 258 177 266" fill="none" stroke="#FFFFFF" strokeWidth={4} />
      <Path d="M147 266 C 157 274 167 274 177 266" fill="none" stroke="#FFFFFF" strokeWidth={4} />

      {/* Flowers */}
      <Line x1={136} y1={296} x2={136} y2={280} stroke="#4F7B45" strokeWidth={3} />
      <Circle cx={136} cy={277} r={6} fill="#E8C33C" />
      <Line x1={150} y1={298} x2={150} y2={284} stroke="#4F7B45" strokeWidth={3} />
      <Circle cx={150} cy={281} r={5} fill="#D2553F" />
      <Line x1={210} y1={296} x2={210} y2={280} stroke="#4F7B45" strokeWidth={3} />
      <Circle cx={210} cy={277} r={6} fill="#FFFFFF" />
      <Line x1={226} y1={298} x2={226} y2={285} stroke="#4F7B45" strokeWidth={3} />
      <Circle cx={226} cy={282} r={5} fill="#E8C33C" />
    </SceneFrame>
  );
}
