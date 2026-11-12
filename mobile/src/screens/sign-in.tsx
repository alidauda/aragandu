import { Image } from "expo-image";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Text } from "@/components/text";
import { signIn, useFarm } from "@/farm/store";
import { color, font, lift, radius, space } from "@/theme";

/** The same email and password as the website. */
export function SignIn() {
  const S = useFarm();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(S.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const waiting = S.outbox.length;

  const go = async () => {
    if (busy) return;
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    setError("");
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.brand }} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ paddingTop: insets.top + 56, paddingBottom: 44, paddingHorizontal: space.xl, alignItems: "center", gap: space.md }}>
          <Image source={require("@/assets/images/icon.png")} style={{ width: 84, height: 84, borderRadius: 22 }} contentFit="cover" accessibilityLabel="Argandu Farms" />
          <Text style={{ fontSize: 30, fontWeight: "700", color: "#ffffff" }}>Argandu Farms</Text>
          <Text style={{ fontSize: font.body, color: "rgba(255,255,255,0.75)", textAlign: "center" }}>The farm's records, in your pocket</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: color.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderCurve: "continuous", padding: space.xl, paddingBottom: insets.bottom + space.xl, gap: space.lg }}>
          <View style={{ gap: space.xs }}>
            <Text style={{ fontSize: font.title, fontWeight: "700" }}>Sign in</Text>
            <Text style={{ color: color.body, lineHeight: 22 }}>Use the email and password you use on the farm's website.</Text>
          </View>
          {S.expired ? <Notice tone="warn">Your sign-in ran out. Sign in again to carry on.</Notice> : null}
          {waiting ? <Notice tone="plain">{`${waiting} ${waiting === 1 ? "entry is" : "entries are"} kept on this phone and will be sent once their owner signs in.`}</Notice> : null}
          <View style={{ backgroundColor: color.card, borderRadius: radius.md, borderCurve: "continuous", padding: space.lg, gap: space.md, boxShadow: lift }}>
            <Field label="Email" kind="email" value={email} onChange={setEmail} />
            <Field label="Password" kind="password" value={password} onChange={setPassword} />
          </View>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Button label="Sign in" onPress={() => void go()} busy={busy} />
          <Text style={{ fontSize: font.small, color: color.muted, textAlign: "center", lineHeight: 19 }}>Forgot your password? Reset it on the website, or ask an admin.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
