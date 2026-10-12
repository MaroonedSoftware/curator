/**
 * A content id in the one spelling curator keeps. Newer firmware reports MY_F0019 where older
 * reports MY-F0019, and an upload's id may not match how the library later lists it, so `_` is
 * stored as `-`.
 */
export const normalizeContentId = (contentId: string): string => contentId.replaceAll('_', '-');
