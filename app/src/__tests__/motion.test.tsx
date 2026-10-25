/// <reference types="jest" />
jest.mock('@/hooks/use-reduced-motion', () => ({ useReducedMotion: jest.fn(() => false) }));

import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DayDots } from '@/components/day-dots';
import { DrawnCheck } from '@/components/drawn-check';
import { StepList } from '@/components/step-list';
import { VoiceHalo } from '@/components/voice-halo';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

/**
 * Motion is for change that happens in front of the person. A screen that opens with work
 * already finished shows it still, and with Reduce Motion on the decorative motion is gone.
 */

function render(element: React.ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  if (!tree) throw new Error('render failed');
  return tree;
}

function animated(tree: ReactTestRenderer): boolean[] {
  return tree.root.findAllByType(DrawnCheck).map((node) => node.props.animate === true);
}

beforeEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
});

describe('checks drawing in', () => {
  it('shows days already done without drawing them', () => {
    expect(animated(render(<DayDots done={3} total={5} />))).toEqual([false, false, false]);
  });

  it('draws only the day finished while the markers were on screen', () => {
    const tree = render(<DayDots done={3} total={5} />);
    act(() => tree.update(<DayDots done={4} total={5} />));
    expect(animated(tree)).toEqual([false, false, false, true]);
  });

  it('draws each processing step as it finishes', () => {
    const steps = ['Preparing', 'Listening', 'Measuring', 'Saving'];
    const tree = render(<StepList steps={steps} current={0} />);
    act(() => tree.update(<StepList steps={steps} current={1} />));
    act(() => tree.update(<StepList steps={steps} current={3} />));
    expect(animated(tree)).toEqual([true, true, true]);
  });
});

describe('voice halo', () => {
  it('is drawn while recording', () => {
    const tree = render(<VoiceHalo level={0.5} active size={200} />);
    expect(tree.root.findAll((node) => node.props.testID === 'voice-halo').length).toBeGreaterThan(0);
  });

  it('is not drawn at all with Reduce Motion on', () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const tree = render(<VoiceHalo level={0.5} active size={200} />);
    expect(tree.toJSON()).toBeNull();
  });
});
