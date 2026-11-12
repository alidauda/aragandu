import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { signIn, useFarm } from "@/farm/store";
import { color, font, space } from "@/theme";

/** The same email and password as the website. */
export function SignIn() {
  const S = useFarm();
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: color.brand }}>Argandu Farms</Text>
          <Text style={{ fontSize: font.body, color: color.body, lineHeight: 22 }}>Sign in with the email and password you use on the farm's website.</Text>
        </View>
        {S.expired ? <Notice tone="warn">Your sign-in ran out. Sign in again to carry on.</Notice> : null}
        {waiting ? <Notice tone="plain">{`${waiting} ${waiting === 1 ? "entry is" : "entries are"} kept on this phone and will be sent once their owner signs in.`}</Notice> : null}
        <View style={{ gap: space.md }}>
          <Field label="Email" kind="email" value={email} onChange={setEmail} />
          <Field label="Password" kind="password" value={password} onChange={setPassword} />
        </View>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button label="Sign in" onPress={() => void go()} busy={busy} />
        <Text style={{ fontSize: font.small, color: color.muted, textAlign: "center", lineHeight: 19 }}>
          Forgot your password? Reset it on the website, or ask an admin.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
