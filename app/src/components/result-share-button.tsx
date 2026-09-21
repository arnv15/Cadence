import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, type ButtonVariant } from '@/components/button';
import { AppText } from '@/components/text';
import { errorMessage } from '@/constants/format';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shareReport } from '@/report';

export interface ResultShareButtonProps {
  label?: string;
  hint?: string;
  variant?: ButtonVariant;
  testID?: string;
}

/**
 * Renders the report to a PDF and opens the system share sheet, via services' shareReport().
 *
 * Sharing is the one place a person's speech data leaves the phone, so this never happens on its
 * own: the system share sheet is the person's own choice of where it goes.
 */
export function ResultShareButton({
  label = 'Share summary with a doctor',
  hint = 'Creates a PDF summary and opens the share sheet so you can choose where to send it',
  variant = 'secondary',
  testID,
}: ResultShareButtonProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onPress = useCallback(() => {
    if (busy) return;
    setBusy(true);
    setError(null);
    Promise.resolve()
      .then(() => shareReport())
      .catch((cause: unknown) => {
        if (mounted.current) setError(errorMessage(cause));
      })
      .then(() => {
        if (mounted.current) setBusy(false);
      });
  }, [busy]);

  return (
    <View style={styles.wrap}>
      <Button
        label={label}
        hint={hint}
        onPress={onPress}
        variant={variant}
        icon="share"
        busy={busy}
        testID={testID ?? 'share-report'}
      />
      {error ? (
        <AppText variant="caption" style={{ color: colors.destructive }}>
          {`The summary could not be created. ${error}`}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
});
