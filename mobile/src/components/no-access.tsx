import { Text } from "react-native";

import { Card, CardTitle } from "@/components/card";
import { color, font } from "@/theme";

/** Shown when a page is opened by someone whose roles don't let them record there. */
export function NoAccess({ viewOnly }: { viewOnly?: boolean }) {
  return (
    <Card>
      <CardTitle>{viewOnly ? "View only" : "Not part of your work"}</CardTitle>
      <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>
        {viewOnly ? "An admin has set this to view only for you, so you can't make entries here." : "Your access doesn't include this. An admin can change it on the website (Team)."}
      </Text>
    </Card>
  );
}
