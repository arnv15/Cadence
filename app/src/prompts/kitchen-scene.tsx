import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { SceneFrame, type SceneProps } from '@/prompts/scene-frame';

/**
 * Scene 1 — a busy kitchen where several things are going wrong at once.
 *
 * Describable content: the pot boiling over on the stove, steam, the cat on the counter, the
 * running tap in the sink, the child on the step stool reaching for the jar on the shelf, the
 * dog carrying a sock, the tipped-over fruit bowl on the floor, the window, and the wall clock.
 *
 * Original artwork drawn for Cadence. It is deliberately *not* the Cookie Theft picture.
 */
export function KitchenScene({ width, style, testID }: SceneProps) {
  return (
    <SceneFrame
      width={width}
      style={style}
      testID={testID ?? 'scene-kitchen'}
      label="Picture: a busy kitchen">
      {/* Room */}
      <Rect x={0} y={0} width={400} height={300} fill="#F5EADB" />
      <Rect x={0} y={217} width={400} height={8} fill="#E3D2B8" />
      <Rect x={0} y={225} width={400} height={75} fill="#C49A6C" />
      <Line x1={0} y1={252} x2={400} y2={252} stroke="#AC8250" strokeWidth={2} />
      <Line x1={0} y1={278} x2={400} y2={278} stroke="#AC8250" strokeWidth={2} />

      {/* Window */}
      <Rect x={125} y={32} width={80} height={72} rx={4} fill="#9FD3E8" />
      <Circle cx={147} cy={52} r={9} fill="#FFF3CE" />
      <Ellipse cx={183} cy={54} rx={15} ry={7} fill="#FFFFFF" />
      <Rect x={125} y={32} width={80} height={72} rx={4} fill="none" stroke="#8A5830" strokeWidth={6} />
      <Line x1={165} y1={32} x2={165} y2={104} stroke="#8A5830" strokeWidth={5} />
      <Line x1={125} y1={68} x2={205} y2={68} stroke="#8A5830" strokeWidth={5} />

      {/* Wall clock */}
      <Circle cx={240} cy={58} r={22} fill="#FFFFFF" stroke="#2B2118" strokeWidth={4} />
      <Line x1={240} y1={58} x2={240} y2={43} stroke="#2B2118" strokeWidth={4} strokeLinecap="round" />
      <Line x1={240} y1={58} x2={252} y2={63} stroke="#2B2118" strokeWidth={4} strokeLinecap="round" />

      {/* Shelf with jars */}
      <Rect x={276} y={72} width={112} height={9} rx={2} fill="#A86F3F" />
      <Polygon points="284,81 292,81 284,95" fill="#8A5830" />
      <Polygon points="380,81 372,81 380,95" fill="#8A5830" />
      <Rect x={282} y={52} width={22} height={20} rx={3} fill="#6E8F5E" />
      <Rect x={306} y={40} width={40} height={32} rx={6} fill="#C25A3A" />
      <Rect x={302} y={30} width={48} height={11} rx={4} fill="#8A3F28" />
      <Rect x={354} y={48} width={26} height={24} rx={3} fill="#4F9DD1" />

      {/* Counter and cabinets */}
      <Rect x={0} y={180} width={250} height={70} fill="#A86F3F" />
      <Rect x={122} y={190} width={52} height={50} rx={4} fill="#95602F" />
      <Rect x={182} y={190} width={52} height={50} rx={4} fill="#95602F" />
      <Line x1={166} y1={214} x2={166} y2={226} stroke="#EFE4D2" strokeWidth={4} strokeLinecap="round" />
      <Line x1={190} y1={214} x2={190} y2={226} stroke="#EFE4D2" strokeWidth={4} strokeLinecap="round" />
      <Rect x={0} y={168} width={250} height={14} rx={3} fill="#EFE4D2" />

      {/* Sink with a running tap */}
      <Rect x={130} y={166} width={72} height={18} rx={5} fill="#C6D0D3" />
      <Rect x={137} y={170} width={58} height={11} rx={3} fill="#93A2A7" />
      <Path
        d="M152 166 L152 132 Q152 124 164 124 L178 124"
        fill="none"
        stroke="#6E7B80"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Line x1={178} y1={128} x2={178} y2={170} stroke="#4F9DD1" strokeWidth={6} strokeLinecap="round" />
      <Circle cx={172} cy={160} r={3} fill="#4F9DD1" />
      <Circle cx={185} cy={150} r={3} fill="#4F9DD1" />

      {/* Stove with a pot boiling over */}
      <Rect x={14} y={174} width={98} height={76} rx={4} fill="#8E969A" />
      <Rect x={24} y={192} width={78} height={40} rx={5} fill="#3F4A4E" />
      <Line x1={24} y1={183} x2={102} y2={183} stroke="#DDE3E5" strokeWidth={6} strokeLinecap="round" />
      <Rect x={12} y={162} width={102} height={12} rx={4} fill="#3F4A4E" />
      <Ellipse cx={40} cy={168} rx={20} ry={5} fill="#232B2E" />
      <Ellipse cx={88} cy={168} rx={20} ry={5} fill="#232B2E" />
      <Path d="M40 130 L100 130 L94 166 L46 166 Z" fill="#8FA3A8" />
      <Rect x={34} y={122} width={72} height={10} rx={4} fill="#6E7B80" />
      <Path
        d="M46 132 C 38 144 36 156 40 166"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Ellipse cx={42} cy={168} rx={15} ry={5} fill="#FFFFFF" />
      <Circle cx={52} cy={120} r={8} fill="#FFFFFF" />
      <Circle cx={68} cy={115} r={10} fill="#FFFFFF" />
      <Circle cx={84} cy={119} r={7} fill="#FFFFFF" />
      <Circle cx={96} cy={123} r={5} fill="#FFFFFF" />
      <Path
        d="M56 106 C 48 96 64 90 56 78"
        fill="none"
        stroke="#C2D2D7"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path
        d="M74 102 C 66 92 82 86 74 74"
        fill="none"
        stroke="#C2D2D7"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <Path
        d="M92 108 C 84 98 100 92 92 82"
        fill="none"
        stroke="#C2D2D7"
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Cat on the counter */}
      <Path
        d="M240 166 C 258 158 256 136 244 134"
        fill="none"
        stroke="#4A3F35"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Ellipse cx={218} cy={150} rx={24} ry={18} fill="#4A3F35" />
      <Ellipse cx={220} cy={158} rx={16} ry={9} fill="#6B5C4D" />
      <Circle cx={204} cy={128} r={15} fill="#4A3F35" />
      <Polygon points="192,122 194,106 205,116" fill="#4A3F35" />
      <Polygon points="205,116 216,104 217,121" fill="#4A3F35" />
      <Circle cx={199} cy={127} r={3} fill="#F5EADB" />
      <Circle cx={210} cy={127} r={3} fill="#F5EADB" />

      {/* Child on a step stool reaching for the jar */}
      <Rect x={300} y={206} width={48} height={9} rx={2} fill="#8A6F4B" />
      <Line x1={307} y1={215} x2={303} y2={238} stroke="#8A6F4B" strokeWidth={7} strokeLinecap="round" />
      <Line x1={341} y1={215} x2={345} y2={238} stroke="#8A6F4B" strokeWidth={7} strokeLinecap="round" />
      <Rect x={311} y={170} width={11} height={38} fill="#3A5A7A" />
      <Rect x={327} y={170} width={11} height={38} fill="#3A5A7A" />
      <Rect x={305} y={130} width={40} height={44} rx={11} fill="#E0704F" />
      <Path
        d="M338 140 L350 106 L336 84"
        fill="none"
        stroke="#F0C39A"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M308 140 L296 164"
        fill="none"
        stroke="#F0C39A"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Circle cx={325} cy={114} r={16} fill="#F0C39A" />
      <Path d="M309 112 C 309 92 341 92 341 112 Z" fill="#5A3B22" />
      <Circle cx={320} cy={116} r={2.6} fill="#2B2118" />
      <Circle cx={331} cy={116} r={2.6} fill="#2B2118" />

      {/* Tipped-over fruit bowl */}
      <G rotation={-35} origin="64, 272">
        <Path d="M38 272 A 26 26 0 0 0 90 272 Z" fill="#6E8F5E" />
        <Ellipse cx={64} cy={272} rx={26} ry={6} fill="#8FB07E" />
      </G>
      <Circle cx={26} cy={282} r={9} fill="#E4913C" />
      <Circle cx={48} cy={289} r={8} fill="#E4913C" />
      <Circle cx={98} cy={280} r={9} fill="#E4913C" />

      {/* Dog carrying a sock */}
      <Path
        d="M124 250 C 110 240 108 228 118 224"
        fill="none"
        stroke="#D9A65C"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <Rect x={132} y={274} width={11} height={20} rx={4} fill="#C08F45" />
      <Rect x={152} y={276} width={11} height={18} rx={4} fill="#D9A65C" />
      <Rect x={174} y={276} width={11} height={18} rx={4} fill="#C08F45" />
      <Rect x={192} y={274} width={11} height={20} rx={4} fill="#D9A65C" />
      <Ellipse cx={162} cy={262} rx={44} ry={24} fill="#D9A65C" />
      <Circle cx={206} cy={252} r={20} fill="#D9A65C" />
      <Path d="M198 234 C 188 228 184 248 194 254 Z" fill="#B5813C" />
      <Ellipse cx={222} cy={258} rx={13} ry={9} fill="#EFC98C" />
      <Circle cx={231} cy={255} r={4} fill="#2B2118" />
      <Circle cx={207} cy={245} r={3.2} fill="#2B2118" />
      <Rect x={226} y={262} width={38} height={15} rx={7} fill="#F7F7F5" stroke="#AFBCC4" strokeWidth={2} />
      <Line x1={240} y1={263} x2={240} y2={276} stroke="#4F9DD1" strokeWidth={3} />
      <Line x1={249} y1={263} x2={249} y2={276} stroke="#4F9DD1" strokeWidth={3} />
    </SceneFrame>
  );
}
