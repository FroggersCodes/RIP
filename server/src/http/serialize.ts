import type { User } from '@prisma/client';

/** Strip secrets; shape the user object the client is allowed to see. */
export function publicUser(u: User) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    tokens: u.tokens,
    cases: u.cases,
    dust: u.dust,
    rating: u.rating,
    dailyStreak: u.dailyStreak,
    lastDailyClaimAt: u.lastDailyClaimAt,
    createdAt: u.createdAt,
  };
}
