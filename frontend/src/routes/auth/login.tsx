import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signIn } from "@/lib/auth";

// NOTE: the monolith's "Sign in with Google" button (via src/integrations/lovable)
// was dropped in the backend/frontend split — that OAuth integration isn't part
// of this project yet. Plain email/password sign-in only for now.

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Min 6 characters"),
});

export default function Login() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  return (
    <div>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your dashboard.</p>
      <form onSubmit={handleSubmit(async (d) => {
        try { await signIn(d.email.trim(), d.password); toast.success("Signed in"); navigate({ to: "/dashboard" as any }); }
        catch (e) { toast.error((e as Error).message || "Sign in failed"); }
      })} className="mt-6 space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="you@example.com" {...register("email")} />{errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}</div>
        <div>
          <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link></div>
          <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full gradient-brand">Sign in</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">No account? <Link to="/register" className="text-primary hover:underline">Create one</Link></p>
    </div>
  );
}
