import { describe, it, expect } from 'vitest';
import { resolveMigratedTab } from '../App';

describe('Navigation Migration & Tab Routing (Step 4)', () => {
  it('maps legacy spatial and timing tabs to blast workspace sub-tabs', () => {
    expect(resolveMigratedTab('benchmap')).toEqual({ tab: 'blast', subTab: 'pattern' });
    expect(resolveMigratedTab('timing')).toEqual({ tab: 'blast', subTab: 'timing' });
  });

  it('maps removed kriging and telemetry tabs to blast workspace record sub-tab', () => {
    expect(resolveMigratedTab('kriging')).toEqual({ tab: 'blast', subTab: 'record' });
    expect(resolveMigratedTab('telemetry')).toEqual({ tab: 'blast', subTab: 'record' });
  });

  it('maps legacy Kuz-Ram, Mine-to-Mill and Comminution tabs to optimise workspace sub-tabs', () => {
    expect(resolveMigratedTab('kuzram')).toEqual({ tab: 'optimise', subTab: 'kuzram' });
    expect(resolveMigratedTab('minetomill')).toEqual({ tab: 'optimise', subTab: 'minetomill' });
    expect(resolveMigratedTab('comminution')).toEqual({ tab: 'optimise', subTab: 'twin' });
  });

  it('handles experimental module tabs according to setting', () => {
    // When experimental is disabled (default)
    expect(resolveMigratedTab('drone3d', false, false)).toEqual({ tab: 'blast', subTab: 'record' });
    expect(resolveMigratedTab('beltvision', false, false)).toEqual({ tab: 'blast', subTab: 'record' });
    expect(resolveMigratedTab('experimental', false, false)).toEqual({ tab: 'blast', subTab: 'record' });

    // When experimental is enabled
    expect(resolveMigratedTab('drone3d', false, true)).toEqual({ tab: 'experimental', subTab: 'drone3d' });
    expect(resolveMigratedTab('beltvision', false, true)).toEqual({ tab: 'experimental', subTab: 'beltvision' });
    expect(resolveMigratedTab('experimental', false, true)).toEqual({ tab: 'experimental' });
  });

  it('preserves existing top-level workspace tabs', () => {
    expect(resolveMigratedTab('blast')).toEqual({ tab: 'blast', subTab: 'record' });
    expect(resolveMigratedTab('validation')).toEqual({ tab: 'validation' });
    expect(resolveMigratedTab('optimise')).toEqual({ tab: 'optimise', subTab: 'kuzram' });
    expect(resolveMigratedTab('settings')).toEqual({ tab: 'settings' });
    expect(resolveMigratedTab('help')).toEqual({ tab: 'help' });
    expect(resolveMigratedTab('wizard')).toEqual({ tab: 'wizard' });
  });

  it('falls back appropriately for null, undefined or unknown tab IDs', () => {
    expect(resolveMigratedTab(null, false)).toEqual({ tab: 'blast' });
    expect(resolveMigratedTab(null, true)).toEqual({ tab: 'wizard' });
    expect(resolveMigratedTab('unknown_random_tab', false)).toEqual({ tab: 'blast' });
    expect(resolveMigratedTab('unknown_random_tab', true)).toEqual({ tab: 'wizard' });
  });
});

