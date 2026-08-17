import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signUp } from "@/lib/auth";

// NOTE: the monolith's "Sign in with Google" button (via src/integrations/lovable)
// was dropped in the backend/frontend split — that OAuth integration isn't part
// of this project yet. Plain email/password sign-up only for now.

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
  referralCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export default function Register() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", referralCode: "" },
  });
  return (
    <div>
      <h1 className="text-3xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Free forever. No credit card required.</p>
      <form
        onSubmit={handleSubmit(async (d) => {
          try {
            await signUp({
              email: d.email.trim(),
              password: d.password,
              name: d.name.trim(),
              referralCode: d.referralCode?.trim() || undefined,
            });
            // Custom auth signs the user in immediately (no email-verification
            // gate) — see README "Known gaps" re: password-reset email delivery.
            toast.success("Account created");
            navigate({ to: "/dashboard" as any });
          } catch (e) {
            toast.error((e as Error).message || "Sign up failed");
          }
        })}
        className="mt-6 space-y-4"
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="referralCode">Referral code (optional)</Label>
          <Input id="referralCode" placeholder="ABC12345" {...register("referralCode")} />
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full gradient-brand">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
