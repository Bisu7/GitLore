import posthog from 'posthog-js';

export const initPostHog = () => {
  if (typeof window !== 'undefined') {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_mock_posthog_key_for_testing';
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    posthog.init(posthogKey, {
      api_host: posthogHost,
      person_profiles: 'identified_only',
      capture_pageview: false, // handled manually or via Next router
      autocapture: false,
    });
  }
};

export type AnalyticsEvent = 
  | 'repo_connected'
  | 'search_performed'
  | 'answer_viewed'
  | 'commit_detail_viewed'
  | 'timeline_opened'
  | 'drift_dashboard_viewed'
  | 'upgrade_clicked'
  | 'upgrade_completed';

export const trackEvent = (event: AnalyticsEvent, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined') {
    try {
      posthog.capture(event, properties);
      console.log(`[PostHog Track]: ${event}`, properties);
    } catch (e) {
      console.warn(`[PostHog Error]: ${e}`);
    }
  }
};
