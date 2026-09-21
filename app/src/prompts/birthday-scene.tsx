import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { SceneFrame, type SceneProps } from '@/prompts/scene-frame';

/**
 * Scene 4 — a birthday in the living room, with one guest behaving badly.
 *
 * Describable content: the cake and its lit candles, the balloons tied to the sofa, the cat
 * pushing the wrapped gift over, the grandparent sitting on the floor wrapping a present, the
 * roll of paper and the ribbon, the bunting, the window, the picture on the wall, the floor
 * lamp, the party hat and the spilled cup.
 */
export function BirthdayScene({ width, style, testID }: SceneProps) {
  return (
    <SceneFrame
      width={width}
      style={style}
      testID={testID ?? 'scene-birthday'}
      label="Picture: a birthday in a living room">
      {/* Room */}
      <Rect x={0} y={0} width={400} height={212} fill="#F0E4D4" />
      <Rect x={0} y={206} width={400} height={8} fill="#DCCBB2" />
      <Rect x={0} y={212} width={400} height={88} fill="#C08F58" />
      <Rect x={16} y={246} width={368} height={50} rx={14} fill="#D3BEA2" />

      {/* Bunting */}
      <Path d="M8 26 Q 200 62 392 26" fill="none" stroke="#8A5830" strokeWidth={3} />
      <Polygon points="35,32 57,32 46,58" fill="#D2553F" />
      <Polygon points="81,38 103,38 92,64" fill="#E8C33C" />
      <Polygon points="127,42 149,42 138,68" fill="#4F9DD1" />
      <Polygon points="173,44 195,44 184,70" fill="#6E8F5E" />
      <Polygon points="219,43 241,43 230,69" fill="#D2553F" />
      <Polygon points="265,41 287,41 276,67" fill="#E8C33C" />
      <Polygon points="311,36 333,36 322,62" fill="#4F9DD1" />
      <Polygon points="350,31 372,31 361,57" fill="#6E8F5E" />

      {/* Window */}
      <Rect x={26} y={50} width={84} height={76} rx={3} fill="#9FD3E8" />
      <Ellipse cx={86} cy={70} rx={16} ry={8} fill="#FFFFFF" />
      <Rect x={26} y={50} width={84} height={76} rx={3} fill="none" stroke="#8A5830" strokeWidth={6} />
      <Line x1={68} y1={50} x2={68} y2={126} stroke="#8A5830" strokeWidth={5} />
      <Line x1={26} y1={88} x2={110} y2={88} stroke="#8A5830" strokeWidth={5} />
      <Rect x={14} y={44} width={16} height={92} rx={5} fill="#C25A3A" />
      <Rect x={106} y={44} width={16} height={92} rx={5} fill="#C25A3A" />
      <Rect x={10} y={38} width={116} height={9} rx={4} fill="#8A5830" />

      {/* Picture on the wall */}
      <Rect x={130} y={58} width={66} height={52} rx={3} fill="#EFF5E6" />
      <Path d="M133 104 C 148 82 162 100 176 84 C 186 74 192 94 193 104 Z" fill="#6E8F5E" />
      <Circle cx={148} cy={74} r={8} fill="#E8C33C" />
      <Rect x={130} y={58} width={66} height={52} rx={3} fill="none" stroke="#8A5830" strokeWidth={5} />

      {/* Balloons tied to the sofa */}
      <Path d="M268 86 C 272 100 292 110 300 122" fill="none" stroke="#8A8A8A" strokeWidth={2} />
      <Path d="M306 70 C 306 92 300 108 300 122" fill="none" stroke="#8A8A8A" strokeWidth={2} />
      <Path d="M338 93 C 334 104 310 114 300 122" fill="none" stroke="#8A8A8A" strokeWidth={2} />
      <Ellipse cx={268} cy={58} rx={22} ry={27} fill="#D2553F" />
      <Polygon points="264,84 272,84 268,91" fill="#A83F28" />
      <Ellipse cx={306} cy={40} rx={24} ry={29} fill="#E8C33C" />
      <Polygon points="302,68 310,68 306,75" fill="#B89226" />
      <Ellipse cx={338} cy={66} rx={21} ry={26} fill="#6E8F5E" />
      <Polygon points="334,91 342,91 338,98" fill="#4F6A44" />
      <Ellipse cx={260} cy={48} rx={5} ry={7} fill="#EFA48C" />
      <Ellipse cx={298} cy={30} rx={5} ry={7} fill="#F6E2A0" />

      {/* Sofa */}
      <Rect x={200} y={120} width={160} height={58} rx={13} fill="#587E8E" />
      <Line x1={254} y1={130} x2={254} y2={172} stroke="#46697A" strokeWidth={3} />
      <Line x1={308} y1={130} x2={308} y2={172} stroke="#46697A" strokeWidth={3} />
      <Rect x={190} y={150} width={22} height={54} rx={10} fill="#4C7182" />
      <Rect x={348} y={150} width={22} height={54} rx={10} fill="#4C7182" />
      <Rect x={196} y={168} width={168} height={34} rx={11} fill="#6E92A3" />
      <Rect x={206} y={200} width={9} height={13} fill="#7A5433" />
      <Rect x={346} y={200} width={9} height={13} fill="#7A5433" />

      {/* Floor lamp */}
      <Ellipse cx={380} cy={212} rx={18} ry={6} fill="#6E7378" />
      <Line x1={380} y1={212} x2={380} y2={92} stroke="#6E7378" strokeWidth={6} strokeLinecap="round" />
      <Path d="M358 92 L398 92 L392 58 L364 58 Z" fill="#E8C33C" />

      {/* Table with the birthday cake */}
      <Rect x={14} y={186} width={116} height={12} rx={4} fill="#A0713F" />
      <Rect x={24} y={198} width={11} height={58} fill="#8A5830" />
      <Rect x={109} y={198} width={11} height={58} fill="#8A5830" />
      <Rect x={44} y={156} width={56} height={30} rx={5} fill="#F2D9C0" />
      <Path d="M44 164 C 52 158 60 170 68 164 C 76 158 84 170 92 164 C 96 161 98 162 100 164" fill="none" stroke="#D2553F" strokeWidth={4} />
      <Rect x={54} y={138} width={36} height={19} rx={5} fill="#F7E6D4" />
      <Rect x={59} y={120} width={5} height={18} rx={2} fill="#4F9DD1" />
      <Rect x={69} y={116} width={5} height={22} rx={2} fill="#D2553F" />
      <Rect x={79} y={120} width={5} height={18} rx={2} fill="#6E8F5E" />
      <Ellipse cx={61.5} cy={115} rx={4} ry={7} fill="#FFB03A" />
      <Ellipse cx={71.5} cy={111} rx={4} ry={7} fill="#FFB03A" />
      <Ellipse cx={81.5} cy={115} rx={4} ry={7} fill="#FFB03A" />

      {/* Grandparent wrapping a present on the floor */}
      <Path d="M176 242 L136 258" stroke="#4A5A6E" strokeWidth={19} strokeLinecap="round" />
      <Ellipse cx={130} cy={260} rx={13} ry={8} fill="#3A3A3A" />
      <Rect x={170} y={196} width={44} height={50} rx={15} fill="#6E8F5E" />
      <Path d="M176 212 L158 240" stroke="#E8B98C" strokeWidth={11} strokeLinecap="round" />
      <Path d="M210 212 L216 240" stroke="#E8B98C" strokeWidth={11} strokeLinecap="round" />
      <Circle cx={192} cy={178} r={18} fill="#E8B98C" />
      <Path d="M174 176 C 174 157 210 157 210 176 Z" fill="#C9C9C9" />
      <Circle cx={185} cy={180} r={5} fill="none" stroke="#3A3A3A" strokeWidth={2} />
      <Circle cx={199} cy={180} r={5} fill="none" stroke="#3A3A3A" strokeWidth={2} />
      <Line x1={190} y1={180} x2={194} y2={180} stroke="#3A3A3A" strokeWidth={2} />
      <Rect x={150} y={240} width={70} height={30} rx={3} fill="#4F9DD1" />
      <Rect x={178} y={240} width={10} height={30} fill="#F7F2E6" />
      <Rect x={228} y={252} width={50} height={15} rx={7} fill="#E8C33C" />
      <Line x1={238} y1={252} x2={232} y2={267} stroke="#C9A02C" strokeWidth={3} />
      <Line x1={256} y1={252} x2={250} y2={267} stroke="#C9A02C" strokeWidth={3} />
      <Circle cx={236} cy={236} r={10} fill="#D2553F" />
      <Circle cx={236} cy={236} r={3} fill="#F0E4D4" />

      {/* Cat pushing the gift over */}
      <G rotation={18} origin="340, 262">
        <Rect x={316} y={238} width={52} height={46} rx={3} fill="#C25A3A" />
        <Rect x={336} y={238} width={11} height={46} fill="#E8C33C" />
        <Rect x={316} y={256} width={52} height={10} fill="#E8C33C" />
        <Circle cx={336} cy={234} r={8} fill="#E8C33C" />
        <Circle cx={348} cy={234} r={8} fill="#E8C33C" />
      </G>
      <Path d="M270 268 C 256 260 256 240 266 236" fill="none" stroke="#3E3A35" strokeWidth={8} strokeLinecap="round" />
      <Rect x={276} y={274} width={10} height={16} rx={4} fill="#2E2B27" />
      <Rect x={294} y={274} width={10} height={16} rx={4} fill="#3E3A35" />
      <Ellipse cx={290} cy={266} rx={27} ry={18} fill="#3E3A35" />
      <Path d="M312 252 L326 240" stroke="#3E3A35" strokeWidth={10} strokeLinecap="round" />
      <Circle cx={308} cy={238} r={14} fill="#3E3A35" />
      <Polygon points="296,232 298,218 308,228" fill="#3E3A35" />
      <Polygon points="308,228 319,217 320,233" fill="#3E3A35" />
      <Circle cx={303} cy={238} r={2.8} fill="#E8C33C" />
      <Circle cx={313} cy={238} r={2.8} fill="#E8C33C" />

      {/* Party hat and a spilled cup */}
      <Polygon points="60,292 84,292 72,256" fill="#4F9DD1" />
      <Circle cx={72} cy={254} r={5} fill="#E8C33C" />
      <Circle cx={68} cy={282} r={3} fill="#F7F2E6" />
      <Circle cx={76} cy={272} r={3} fill="#F7F2E6" />
      <Ellipse cx={128} cy={288} rx={24} ry={8} fill="#E4913C" />
      <G rotation={72} origin="108, 280">
        <Path d="M99 266 L119 266 L115 288 L103 288 Z" fill="#F7F2E6" />
      </G>
    </SceneFrame>
  );
}
