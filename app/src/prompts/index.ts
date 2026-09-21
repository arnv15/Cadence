import type { ComponentType } from 'react';

import { BeachScene } from '@/prompts/beach-scene';
import { BirthdayScene } from '@/prompts/birthday-scene';
import { KitchenScene } from '@/prompts/kitchen-scene';
import { ParkScene } from '@/prompts/park-scene';
import type { SceneProps } from '@/prompts/scene-frame';

export type { SceneProps } from '@/prompts/scene-frame';
export { SCENE_ASPECT, SCENE_HEIGHT, SCENE_WIDTH, SceneFrame } from '@/prompts/scene-frame';

export interface PicturePrompt {
  /** Stored on the session as `promptId`. Never renumber these. */
  id: string;
  /** Short plain-language name, shown above the picture. */
  title: string;
  Scene: ComponentType<SceneProps>;
}

/**
 * Original scenes drawn for Cadence. They are deliberately not the Cookie Theft picture: that
 * image is copyrighted, and a person who has seen it in a clinic would not be describing it cold.
 * Each scene holds at least eight things worth mentioning, so there is always plenty to say.
 */
export const PICTURE_PROMPTS: readonly PicturePrompt[] = [
  { id: 'kitchen', title: 'The busy kitchen', Scene: KitchenScene },
  { id: 'park', title: 'A day at the park', Scene: ParkScene },
  { id: 'beach', title: 'Picnic at the beach', Scene: BeachScene },
  { id: 'birthday', title: 'The birthday party', Scene: BirthdayScene },
];

/**
 * Rotates through the scenes so the same picture is not described two days running.
 * `index` is normally the number of picture sessions already recorded.
 */
export function pickPrompt(index: number): PicturePrompt {
  const count = PICTURE_PROMPTS.length;
  const whole = Number.isFinite(index) ? Math.floor(index) : 0;
  const position = ((whole % count) + count) % count;
  return PICTURE_PROMPTS[position];
}

/** Looks up a scene by the `promptId` stored on a session. */
export function promptById(id: string | null): PicturePrompt | null {
  if (id === null) return null;
  return PICTURE_PROMPTS.find((prompt) => prompt.id === id) ?? null;
}
