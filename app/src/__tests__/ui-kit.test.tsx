/// <reference types="jest" />
import { Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { DayDots } from '@/components/day-dots';
import { Glyph } from '@/components/glyph';
import { ListGroup, ListRow } from '@/components/list';
import { StepList } from '@/components/step-list';

/**
 * The shared pieces that carry state a person reads: how many baseline days are done, which
 * processing step is running. Screen readers get the same state as the picture.
 */

function render(element: React.ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(element);
  });
  if (!tree) throw new Error('render failed');
  return tree;
}

function labels(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.type === View)
    .map((node) => node.props.accessibilityLabel as string);
}

describe('DayDots', () => {
  it('reports progress in words and draws a check per finished day', () => {
    const tree = render(<DayDots done={3} total={5} />);
    expect(labels(tree)).toContain('3 of 5 baseline days done');
    expect(tree.root.findAllByType(Glyph).filter((node) => node.props.name === 'check')).toHaveLength(3);
    // Unfinished days are numbered, so the state does not depend on color.
    const numbers = tree.root.findAllByType(Text).map((node) => node.props.children);
    expect(numbers).toEqual([4, 5]);
  });

  it('clamps counts outside the range instead of drawing extra or negative days', () => {
    expect(labels(render(<DayDots done={9} total={5} />))).toContain('5 of 5 baseline days done');
    expect(labels(render(<DayDots done={-2} total={5} />))).toContain('0 of 5 baseline days done');
  });
});

describe('StepList', () => {
  it('marks steps before the current one done and later ones waiting', () => {
    const tree = render(<StepList steps={['One', 'Two', 'Three']} current={1} />);
    expect(labels(tree)).toEqual(['One, done', 'Two, in progress', 'Three, waiting']);
  });
});

describe('ListGroup', () => {
  it('puts a separator between rows but not around them', () => {
    const tree = render(
      <ListGroup testID="group">
        <ListRow icon="chart" title="First" />
        {false}
        <ListRow icon="info" title="Second" />
      </ListGroup>,
    );
    const rows = tree.root.findAll(
      (node) => node.type === View && typeof node.props.accessibilityLabel === 'string',
    );
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(['First', 'Second']);
    const clip = tree.root.findByProps({ testID: 'group' }).findAllByType(View)[1];
    // Two entries, not three: the falsy child was dropped, so it left no gap or double line.
    expect(clip.props.children.flat()).toHaveLength(2);
    expect(rows).toHaveLength(2);
  });
});
