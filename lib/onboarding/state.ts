// Onboarding state derived from existing entities. No migration required:
// completion is computed live from data already in the workspace.

import { prisma } from '@/lib/db/prisma';
import { getWorkspaceContext } from '@/lib/auth/workspace';

export type OnboardingStepKey =
  | 'safety'
  | 'source'
  | 'cartridge'
  | 'component'
  | 'rifle'
  | 'load'
  | 'session'
  | 'pressureSetup';

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  href: string;
  cta: string;
  optional?: boolean;
  done: boolean;
};

export type OnboardingState = {
  workspaceId: string | null;
  steps: OnboardingStep[];
  doneCount: number;
  totalRequired: number;
  pct: number;
  isComplete: boolean;
  setupError?: string;
};

export async function getOnboardingState(): Promise<OnboardingState> {
  let ctx;
  try {
    ctx = await getWorkspaceContext();
  } catch (e) {
    return setupErrorState(e instanceof Error ? e.message : 'Workspace unavailable.');
  }

  try {
    const wid = ctx.workspaceId;
    const [sources, cartridges, components, rifles, loads, sessions, pressureRuns] =
      await Promise.all([
        prisma.source.count({ where: { workspaceId: wid } }),
        prisma.cartridge.count({ where: { workspaceId: wid } }),
        prisma.component.count({ where: { workspaceId: wid } }),
        prisma.rifle.count({ where: { workspaceId: wid } }),
        prisma.load.count({ where: { workspaceId: wid } }),
        prisma.rangeSession.count({ where: { workspaceId: wid } }),
        prisma.pressureEngineRun.count({ where: { workspaceId: wid } }).catch(() => 0),
      ]);

    const steps: OnboardingStep[] = [
      {
        key: 'safety',
        title: 'Read the safety policy',
        description:
          'Required reading. Confirms that LoadBench Pro is a notebook, not a load engine.',
        href: '/safety',
        cta: 'Read safety policy',
        // We cannot persist acknowledgment without a migration. Surface as
        // optional-but-strongly-recommended; the dashboard prompts on every visit.
        done: false,
      },
      {
        key: 'source',
        title: 'Cite your first published source',
        description:
          'Loads cannot save a charge without a citation. Record your manuals, manufacturer sheets, or magazine data first.',
        href: '/sources',
        cta: sources === 0 ? 'Add a source' : 'Manage sources',
        done: sources > 0,
      },
      {
        key: 'cartridge',
        title: 'Add the cartridges you reload for',
        description:
          'Cartridges are the reference frame for every load and rifle.',
        href: '/cartridges',
        cta: cartridges === 0 ? 'Add a cartridge' : 'Manage cartridges',
        done: cartridges > 0,
      },
      {
        key: 'component',
        title: 'Stock components by lot',
        description:
          'Bullets, powders, primers, and cases. Lot numbers tie observed sessions to a specific batch.',
        href: '/components',
        cta: components === 0 ? 'Add a component' : 'Manage components',
        done: components > 0,
      },
      {
        key: 'rifle',
        title: 'Add at least one rifle',
        description: 'Rifle profiles let sessions and loads attribute results to a barrel.',
        href: '/rifles',
        cta: rifles === 0 ? 'Add a rifle' : 'Manage rifles',
        done: rifles > 0,
      },
      {
        key: 'load',
        title: 'Record your first load',
        description:
          'Pick the cartridge, bullet, powder, and cited source. LoadBench Pro will refuse to save a charge above the cited published maximum.',
        href: '/loads/new',
        cta: loads === 0 ? 'Record a load' : 'Record another load',
        done: loads > 0,
      },
      {
        key: 'session',
        title: 'Log a range or chrono session',
        description:
          'Record observed velocity, ES/SD, and group size. The chrono importer accepts a CSV paste.',
        href: '/sessions',
        cta: sessions === 0 ? 'Log a session' : 'Log another session',
        done: sessions > 0,
      },
      {
        key: 'pressureSetup',
        title: 'Optional: review the pressure-engine setup',
        description:
          'The premium pressure-engine workspace is a validation surface. It does not predict pressure. The setup wizard explains what data you can collect.',
        href: '/pressure-engine/setup',
        cta: 'Review setup',
        optional: true,
        done: pressureRuns > 0,
      },
    ];

    const required = steps.filter((s) => !s.optional);
    const requiredDone = required.filter((s) => s.done).length;
    const totalRequired = required.length;
    const pct = totalRequired === 0 ? 100 : Math.round((requiredDone / totalRequired) * 100);

    return {
      workspaceId: wid,
      steps,
      doneCount: requiredDone,
      totalRequired,
      pct,
      isComplete: requiredDone === totalRequired,
    };
  } catch (e) {
    return setupErrorState(e instanceof Error ? e.message : 'Database unavailable.');
  }
}

function setupErrorState(message: string): OnboardingState {
  return {
    workspaceId: null,
    steps: [],
    doneCount: 0,
    totalRequired: 0,
    pct: 0,
    isComplete: false,
    setupError: message,
  };
}
