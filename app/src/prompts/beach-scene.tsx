import { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import { SceneFrame, type SceneProps } from '@/prompts/scene-frame';

/**
 * Scene 3 — a picnic on the beach on a windy day.
 *
 * Describable content: the seagull flying off with a sandwich, the sandcastle with its flag,
 * the umbrella tumbling away in the wind, the child running after it, the picnic blanket, the
 * basket and cups, the bucket and spade, the beach ball, the sailboat and the sea.
 */
export function BeachScene({ width, style, testID }: SceneProps) {
  return (
    <SceneFrame
      width={width}
      style={style}
      testID={testID ?? 'scene-beach'}
      label="Picture: a picnic at the beach">
      {/* Sky, sun, sea, sand */}
      <Rect x={0} y={0} width={400} height={152} fill="#BFE3F2" />
      <Line x1={48} y1={4} x2={48} y2={16} stroke="#FFD94F" strokeWidth={5} strokeLinecap="round" />
      <Line x1={14} y1={42} x2={2} y2={42} stroke="#FFD94F" strokeWidth={5} strokeLinecap="round" />
      <Line x1={22} y1={16} x2={14} y2={8} stroke="#FFD94F" strokeWidth={5} strokeLinecap="round" />
      <Line x1={22} y1={68} x2={14} y2={76} stroke="#FFD94F" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={48} cy={42} r={27} fill="#FFD94F" />
      <Rect x={0} y={148} width={400} height={52} fill="#3E85B4" />
      <Path d="M8 162 C 20 156 32 168 44 162" fill="none" stroke="#7FC0E6" strokeWidth={4} strokeLinecap="round" />
      <Path d="M150 176 C 162 170 174 182 186 176" fill="none" stroke="#7FC0E6" strokeWidth={4} strokeLinecap="round" />
      <Path d="M250 160 C 262 154 274 166 286 160" fill="none" stroke="#7FC0E6" strokeWidth={4} strokeLinecap="round" />
      <Path d="M318 180 C 330 174 342 186 354 180" fill="none" stroke="#7FC0E6" strokeWidth={4} strokeLinecap="round" />

      {/* Sailboat */}
      <Polygon points="96,118 96,158 70,158" fill="#F7F2E6" />
      <Polygon points="102,126 122,158 102,158" fill="#E8DFCC" />
      <Path d="M62 158 L128 158 L118 170 L72 170 Z" fill="#8A5830" />

      {/* Shoreline foam and sand */}
      <Rect x={0} y={192} width={400} height={108} fill="#E8D6A8" />
      <Path
        d="M0 194 C 60 186 120 202 180 196 C 240 190 300 204 400 196 L400 210 L0 210 Z"
        fill="#F7F0DC"
      />

      {/* Umbrella blowing away */}
      <G rotation={-28} origin="280, 84">
        <Line x1={280} y1={84} x2={280} y2={132} stroke="#8A5830" strokeWidth={7} strokeLinecap="round" />
        <Path d="M280 132 C 280 142 292 142 292 134" fill="none" stroke="#8A5830" strokeWidth={6} strokeLinecap="round" />
        <Path d="M280 84 L230 84 A50 50 0 0 1 236.7 59 Z" fill="#D2553F" />
        <Path d="M280 84 L236.7 59 A50 50 0 0 1 255 40.7 Z" fill="#F7F2E6" />
        <Path d="M280 84 L255 40.7 A50 50 0 0 1 280 34 Z" fill="#D2553F" />
        <Path d="M280 84 L280 34 A50 50 0 0 1 305 40.7 Z" fill="#F7F2E6" />
        <Path d="M280 84 L305 40.7 A50 50 0 0 1 323.3 59 Z" fill="#D2553F" />
        <Path d="M280 84 L323.3 59 A50 50 0 0 1 330 84 Z" fill="#F7F2E6" />
        <Line x1={230} y1={84} x2={330} y2={84} stroke="#A83F28" strokeWidth={3} />
      </G>
      <Path d="M206 60 C 222 52 234 60 248 52" fill="none" stroke="#8FBFD9" strokeWidth={4} strokeLinecap="round" />
      <Path d="M200 84 C 216 76 228 84 242 76" fill="none" stroke="#8FBFD9" strokeWidth={4} strokeLinecap="round" />

      {/* Child running after the umbrella */}
      <Path d="M258 200 L244 232" stroke="#3A5A7A" strokeWidth={11} strokeLinecap="round" />
      <Path d="M264 200 L280 228" stroke="#33415E" strokeWidth={11} strokeLinecap="round" />
      <Rect x={250} y={168} width={25} height={34} rx={9} fill="#E8C33C" />
      <Path d="M252 176 L238 152" stroke="#F0C39A" strokeWidth={9} strokeLinecap="round" />
      <Path d="M273 176 L290 158" stroke="#F0C39A" strokeWidth={9} strokeLinecap="round" />
      <Circle cx={262} cy={156} r={13} fill="#F0C39A" />
      <Path d="M249 154 C 249 137 275 137 275 154 Z" fill="#7A4B22" />
      <Circle cx={266} cy={158} r={2.3} fill="#2B2118" />
      <Circle cx={257} cy={158} r={2.3} fill="#2B2118" />

      {/* Seagull making off with a sandwich */}
      <Path d="M155 141 C 140 113 122 111 116 123 C 128 125 141 135 150 145 Z" fill="#E8EEF2" />
      <Ellipse cx={160} cy={147} rx={23} ry={12} fill="#FFFFFF" />
      <Polygon points="139,147 121,140 126,154" fill="#E8EEF2" />
      <Path d="M158 153 C 146 173 130 179 124 169 C 136 165 147 159 155 151 Z" fill="#CFDCE4" />
      <Circle cx={182} cy={137} r={10} fill="#FFFFFF" />
      <Circle cx={185} cy={134} r={2.3} fill="#2B2118" />
      <Polygon points="190,136 206,141 190,145" fill="#E8A33C" />
      <Polygon points="204,131 228,141 204,151" fill="#F0DFA8" />
      <Path d="M207 141 L224 142" stroke="#6E8F5E" strokeWidth={4} strokeLinecap="round" />
      <Path d="M206 146 L222 147" stroke="#C25A3A" strokeWidth={3} strokeLinecap="round" />

      {/* Picnic blanket */}
      <Polygon points="8,236 176,222 196,286 22,296" fill="#F2EADA" />
      <Line x1={11} y1={251} x2={181} y2={238} stroke="#D2553F" strokeWidth={5} />
      <Line x1={15} y1={266} x2={186} y2={254} stroke="#D2553F" strokeWidth={5} />
      <Line x1={18} y1={281} x2={191} y2={270} stroke="#D2553F" strokeWidth={5} />
      <Line x1={50} y1={232} x2={65} y2={294} stroke="#D2553F" strokeWidth={5} />
      <Line x1={92} y1={229} x2={109} y2={291} stroke="#D2553F" strokeWidth={5} />
      <Line x1={134} y1={225} x2={152} y2={289} stroke="#D2553F" strokeWidth={5} />

      {/* Picnic basket and cups */}
      <Path d="M66 214 C 70 190 100 190 104 214" fill="none" stroke="#A0713F" strokeWidth={7} />
      <Path d="M56 212 L114 212 L107 244 L63 244 Z" fill="#C08F45" />
      <Line x1={58} y1={224} x2={112} y2={224} stroke="#9A6E33" strokeWidth={3} />
      <Line x1={60} y1={234} x2={110} y2={234} stroke="#9A6E33" strokeWidth={3} />
      <Path d="M134 248 L154 248 L150 268 L138 268 Z" fill="#4F9DD1" />
      <Path d="M158 262 L176 262 L173 280 L161 280 Z" fill="#6E8F5E" />

      {/* Beach ball */}
      <Circle cx={230} cy={272} r={17} fill="#F7F2E6" />
      <Path d="M230 255 C 240 262 240 282 230 289 Z" fill="#D2553F" />
      <Path d="M230 255 C 220 262 220 282 230 289 Z" fill="#4F9DD1" />

      {/* Bucket and spade */}
      <Line x1={268} y1={284} x2={276} y2={252} stroke="#E4913C" strokeWidth={6} strokeLinecap="round" />
      <Polygon points="262,282 276,286 270,296 258,290" fill="#C25A3A" />
      <Path d="M284 254 C 288 244 302 244 306 254" fill="none" stroke="#3E85B4" strokeWidth={4} />
      <Path d="M280 254 L310 254 L305 282 L285 282 Z" fill="#4F9DD1" />

      {/* Sandcastle */}
      <Ellipse cx={348} cy={276} rx={56} ry={14} fill="#D9C08C" />
      <Rect x={306} y={240} width={86} height={32} rx={3} fill="#DCC28E" />
      <Rect x={310} y={212} width={26} height={30} fill="#E4CE9E" />
      <Rect x={362} y={212} width={26} height={30} fill="#E4CE9E" />
      <Rect x={338} y={200} width={24} height={42} fill="#DCC28E" />
      <Rect x={310} y={206} width={7} height={8} fill="#E4CE9E" />
      <Rect x={322} y={206} width={7} height={8} fill="#E4CE9E" />
      <Rect x={362} y={206} width={7} height={8} fill="#E4CE9E" />
      <Rect x={374} y={206} width={7} height={8} fill="#E4CE9E" />
      <Rect x={318} y={224} width={10} height={12} rx={2} fill="#9A7D46" />
      <Rect x={370} y={224} width={10} height={12} rx={2} fill="#9A7D46" />
      <Rect x={344} y={216} width={12} height={16} rx={5} fill="#9A7D46" />
      <Line x1={350} y1={200} x2={350} y2={176} stroke="#8A5830" strokeWidth={4} strokeLinecap="round" />
      <Polygon points="350,177 374,184 350,191" fill="#D2553F" />
    </SceneFrame>
  );
}
