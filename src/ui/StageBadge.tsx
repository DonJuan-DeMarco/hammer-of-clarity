/** A stage as a name plus three marks, never a number (D2). */
import { STAGES, type Stage } from '../core/stages';
import { t, type MessageKey } from '../adapters/i18n';

const STAGE_NAMES: Record<Stage, MessageKey> = {
  forging: 'stageForging',
  tempering: 'stageTempering',
  clear: 'stageClear',
};

export function StageBadge({ stage }: { stage: Stage }) {
  const reached = STAGES.indexOf(stage);
  return (
    <span class="stage" data-testid="stage" data-stage={stage}>
      <span aria-hidden="true">
        {STAGES.map((s, i) => (
          <span key={s} class={i <= reached ? 'stage-mark stage-mark--on' : 'stage-mark'}>
            {i <= reached ? '◆' : '◇'}
          </span>
        ))}
      </span>{' '}
      {t(STAGE_NAMES[stage])}
    </span>
  );
}
