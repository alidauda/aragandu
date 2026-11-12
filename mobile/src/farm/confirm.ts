import { Alert } from "react-native";

/** Asks before something that can't be undone. */
export function confirm(title: string, message: string, action: string, then: () => void) {
  // The browser build (for testing) has no native alert.
  if (process.env.EXPO_OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) then();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: then },
  ]);
}
