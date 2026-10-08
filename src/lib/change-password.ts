import { authClient } from "@/lib/auth-client";

/**
 * Changes the signed-in user's password and signs out their other devices.
 * Resolves to an error message to show, or null on success.
 */
export async function changePassword(current: string, next: string, confirm: string) {
  if (!current) return "Enter your current password.";
  if (next.length < 8) return "The new password needs at least 8 characters.";
  if (next !== confirm) return "The two new passwords don't match.";
  if (next === current) return "Pick a password different from the current one.";
  const { error } = await authClient.changePassword({
    currentPassword: current,
    newPassword: next,
    revokeOtherSessions: true,
  });
  if (!error) return null;
  if (error.status === 429) return "Too many attempts. Wait a few seconds and try again.";
  if (error.code === "INVALID_PASSWORD" || error.status === 400) return "Your current password is wrong.";
  return "Couldn't change the password. Please try again.";
}
