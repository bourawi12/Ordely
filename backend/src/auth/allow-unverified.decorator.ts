import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/** Lets a signed-in user whose email is not verified yet use this route (the global guard blocks the rest). */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);

/** The 403 message the frontend recognises to send the user to the "check your inbox" page. */
export const EMAIL_NOT_VERIFIED = 'Email address not verified';
