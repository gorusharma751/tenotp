import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, MessageCircle, Clock } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  subject: z.string().trim().min(3, "Subject is required").max(150),
  message: z.string().trim().min(10, "Please share a few more details").max(2000),
});

export default function ContactUs() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({ resolver: zodResolver(schema) });
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Contact Us</h1>
        <p className="mt-3 text-muted-foreground">We're here to help. Reach out and our team will get back to you as soon as possible.</p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        <Card className="glass shadow-soft">
          <CardContent className="p-6">
            <Mail className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">Email Support</h3>
            <p className="mt-1 text-sm text-muted-foreground">Write to us anytime</p>
            <a href="mailto:support@tenotp.pro" className="mt-2 inline-block text-sm text-primary underline break-all">support@tenotp.pro</a>
          </CardContent>
        </Card>
        <Card className="glass shadow-soft">
          <CardContent className="p-6">
            <MessageCircle className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">Telegram</h3>
            <p className="mt-1 text-sm text-muted-foreground">Fastest response</p>
            <Button asChild size="sm" className="mt-3 gradient-brand">
              <a href="https://t.me/tenotp" target="_blank" rel="noopener noreferrer">Open Telegram</a>
            </Button>
          </CardContent>
        </Card>
        <Card className="glass shadow-soft">
          <CardContent className="p-6">
            <Clock className="h-6 w-6 text-primary" />
            <h3 className="mt-3 font-semibold">Support Hours</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mon–Sun</p>
            <p className="text-sm font-medium">9:00 AM – 11:00 PM IST</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8 glass shadow-soft">
        <CardContent className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Send us a message</h2>
          <form
            onSubmit={handleSubmit(async () => {
              await new Promise((r) => setTimeout(r, 500));
              toast.success("Message sent — we'll be in touch");
              reset();
            })}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <div className="sm:col-span-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" {...register("subject")} />
              {errors.subject && <p className="mt-1 text-xs text-destructive">{errors.subject.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" rows={6} {...register("message")} />
              {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={isSubmitting} className="gradient-brand w-full sm:w-auto">Send message</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
