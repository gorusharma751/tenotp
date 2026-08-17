import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendPasswordReset } from "@/lib/auth";

const schema = z.object({ email: z.string().email() });

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  return (
    <div>
      <h1 className="text-3xl font-bold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted-foreground">We'll send you a reset link.</p>
      <form onSubmit={handleSubmit(async (d) => {
        try { await sendPasswordReset(d.email.trim()); toast.success("Reset link sent — check your email"); }
        catch (e) { toast.error((e as Error).message || "Failed to send"); }
      })} className="mt-6 space-y-4">
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}</div>
        <Button type="submit" disabled={isSubmitting} className="w-full gradient-brand">Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </div>
  );
}
