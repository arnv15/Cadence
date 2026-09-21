import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { Radius } from '@/constants/theme';

/** Every scene is drawn in this coordinate space and scaled to the width it is given. */
export const SCENE_WIDTH = 400;
export const SCENE_HEIGHT = 300;
export const SCENE_ASPECT = SCENE_WIDTH / SCENE_HEIGHT;

export interface SceneProps {
  /** Fixed width in points. Omitted, the scene fills the width of its parent. */
  width?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export interface SceneFrameProps extends SceneProps {
  /**
   * Short screen-reader label, for example 'Picture: a busy kitchen'. It deliberately names the
   * scene without describing it — describing the picture is the task.
   */
  label: string;
  children: ReactNode;
}

/**
 * Holds a scene at the right aspect ratio and clips it to the app's card radius. The picture
 * keeps its own flat colors in light and dark mode: it is an illustration to talk about, not
 * app chrome, and recoloring it would change what a person sees between sessions.
 */
export function SceneFrame({ width, style, testID, label, children }: SceneFrameProps) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.frame,
        width === undefined ? styles.fluid : { width, height: width / SCENE_ASPECT },
        style,
      ]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet">
        {children}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  fluid: {
    width: '100%',
    aspectRatio: SCENE_ASPECT,
  },
});
