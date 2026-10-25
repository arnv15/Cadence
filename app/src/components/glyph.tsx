import type { ReactElement } from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

/**
 * Small stroke icons drawn inline so they look identical on iOS and Android and can be
 * rendered in tests. Tier glyphs use three different silhouettes (circle, triangle, square)
 * so a tier is never carried by color alone.
 */
export type GlyphName =
  | 'check-circle'
  | 'alert-triangle'
  | 'medical-square'
  | 'mic'
  | 'chart'
  | 'download'
  | 'info'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'check'
  | 'paw'
  | 'lock'
  | 'share'
  | 'trash'
  | 'refresh'
  | 'stop'
  | 'clock'
  | 'calendar'
  | 'wrench';

export interface GlyphProps {
  name: GlyphName;
  size?: number;
  color: string;
  strokeWidth?: number;
  testID?: string;
}

export function Glyph({ name, size = 24, color, strokeWidth = 2, testID }: GlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      testID={testID ?? `glyph-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {renderGlyph(name, color, strokeWidth)}
    </Svg>
  );
}

function renderGlyph(name: GlyphName, color: string, width: number): ReactElement {
  const stroke = {
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'check-circle':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Polyline points="7.5,12.4 10.7,15.6 16.5,8.8" {...stroke} />
        </>
      );
    case 'alert-triangle':
      return (
        <>
          <Path d="M12 3.6 21.2 19.4a1.2 1.2 0 0 1-1 1.8H3.8a1.2 1.2 0 0 1-1-1.8Z" {...stroke} />
          <Line x1={12} y1={10} x2={12} y2={14.6} {...stroke} />
          <Line x1={12} y1={17.6} x2={12} y2={17.7} {...stroke} />
        </>
      );
    case 'medical-square':
      return (
        <>
          <Rect x={3} y={3} width={18} height={18} rx={4.5} {...stroke} />
          <Line x1={12} y1={7.8} x2={12} y2={16.2} {...stroke} />
          <Line x1={7.8} y1={12} x2={16.2} y2={12} {...stroke} />
        </>
      );
    case 'mic':
      return (
        <>
          <Rect x={9} y={2.8} width={6} height={11.4} rx={3} {...stroke} />
          <Path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" {...stroke} />
          <Line x1={12} y1={18} x2={12} y2={21.2} {...stroke} />
        </>
      );
    case 'chart':
      return (
        <>
          <Polyline points="3.5,16.5 9,11 13,14.5 20.5,6.5" {...stroke} />
          <Line x1={3.5} y1={20.5} x2={20.5} y2={20.5} {...stroke} />
        </>
      );
    case 'download':
      return (
        <>
          <Line x1={12} y1={3.5} x2={12} y2={15} {...stroke} />
          <Polyline points="7.5,10.5 12,15 16.5,10.5" {...stroke} />
          <Path d="M4 17v2.2A1.8 1.8 0 0 0 5.8 21h12.4A1.8 1.8 0 0 0 20 19.2V17" {...stroke} />
        </>
      );
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Line x1={12} y1={11} x2={12} y2={16.5} {...stroke} />
          <Line x1={12} y1={7.6} x2={12} y2={7.7} {...stroke} />
        </>
      );
    case 'chevron-right':
      return <Polyline points="9.5,5 16.5,12 9.5,19" {...stroke} />;
    case 'chevron-left':
      return <Polyline points="14.5,5 7.5,12 14.5,19" {...stroke} />;
    case 'chevron-down':
      return <Polyline points="5,9.5 12,16.5 19,9.5" {...stroke} />;
    case 'check':
      return <Polyline points="5,12.6 9.6,17.2 19,7.2" {...stroke} />;
    case 'paw':
      return (
        <>
          <Path d="M12 12.2c-3 0-5.6 3.3-5.6 5.6 0 1.7 1.4 2.6 3 2.6.9 0 1.7-.5 2.6-.5s1.7.5 2.6.5c1.6 0 3-.9 3-2.6 0-2.3-2.6-5.6-5.6-5.6Z" {...stroke} />
          <Circle cx={5.2} cy={10.4} r={1.9} {...stroke} />
          <Circle cx={9.2} cy={5.6} r={1.9} {...stroke} />
          <Circle cx={14.8} cy={5.6} r={1.9} {...stroke} />
          <Circle cx={18.8} cy={10.4} r={1.9} {...stroke} />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x={4.5} y={10.5} width={15} height={10} rx={2.5} {...stroke} />
          <Path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" {...stroke} />
        </>
      );
    case 'share':
      return (
        <>
          <Line x1={12} y1={3.2} x2={12} y2={14.6} {...stroke} />
          <Polyline points="7.8,7.4 12,3.2 16.2,7.4" {...stroke} />
          <Path d="M4.5 13.5v5.7A1.8 1.8 0 0 0 6.3 21h11.4a1.8 1.8 0 0 0 1.8-1.8v-5.7" {...stroke} />
        </>
      );
    case 'trash':
      return (
        <>
          <Line x1={3.8} y1={6.5} x2={20.2} y2={6.5} {...stroke} />
          <Path d="M6.5 6.5 7.4 20a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.9-13.5" {...stroke} />
          <Path d="M9.5 6.5V4.3A1.3 1.3 0 0 1 10.8 3h2.4a1.3 1.3 0 0 1 1.3 1.3v2.2" {...stroke} />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M20 12a8 8 0 1 1-2.6-5.9" {...stroke} />
          <Polyline points="20.4,3.4 20.4,7.6 16.2,7.6" {...stroke} />
        </>
      );
    case 'stop':
      return <Rect x={6} y={6} width={12} height={12} rx={2.5} {...stroke} />;
    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Polyline points="12,6.6 12,12 16,14.2" {...stroke} />
        </>
      );
    case 'calendar':
      return (
        <>
          <Rect x={3.5} y={5} width={17} height={16} rx={3} {...stroke} />
          <Line x1={3.5} y1={10} x2={20.5} y2={10} {...stroke} />
          <Line x1={8.2} y1={3} x2={8.2} y2={6.6} {...stroke} />
          <Line x1={15.8} y1={3} x2={15.8} y2={6.6} {...stroke} />
        </>
      );
    case 'wrench':
      return (
        <Path
          d="M20 5.4a5 5 0 0 1-6.6 6.2L5.6 19.4a2 2 0 0 1-2.8-2.8l7.8-7.8A5 5 0 0 1 16.8 2.2l-3 3 2 2 3-3Z"
          {...stroke}
        />
      );
  }
}
