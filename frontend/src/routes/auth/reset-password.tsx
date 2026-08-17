import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updatePassword } from "@/lib/auth";

const schema = z
  .object({ password: z.string().min(6), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

export default function ResetPassword() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });
  return (
    <div>
      <h1 className="text-3xl font-bold">Set a new password</h1>
      <form
        onSubmit={handleSubmit(async (d) => {
          try {
            const token = new URLSearchParams(window.location.search).get("token") ?? undefined;
            await updatePassword(d.password, token);
            toast.success("Password updated");
            navigate({ to: "/login" });
          } catch (e) {
            toast.error((e as Error).message || "Failed");
          }
        })}
        className="mt-6 space-y-4"
      >
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" {...register("password")} />
          {errors.password && (
            <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" {...register("confirm")} />
          {errors.confirm && (
            <p className="mt-1 text-xs text-destructive">{errors.confirm.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full gradient-brand">
          Update password
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
