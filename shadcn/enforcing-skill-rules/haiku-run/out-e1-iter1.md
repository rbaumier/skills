```tsx
"use client";

import { Search, AlertCircle, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function UserDashboard({ user, notifications }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = () => {
    setSaving(true);
  };

  const setTheme = (theme: string) => {
    // theme setting logic
  };

  return (
    <div className="flex flex-col gap-6 bg-background text-foreground">
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">{user.bio}</p>
          <Avatar className="size-12">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex gap-0">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium">
                Display Name
              </label>
              <Input id="name" defaultValue={user.name} />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <InputGroup>
                <InputGroupTextarea id="bio" defaultValue={user.bio} />
              </InputGroup>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Theme</h3>
              <div className="flex gap-2">
                {["light", "dark", "system"].map((t) => (
                  <Button
                    key={t}
                    variant={activeTab === t ? "default" : "outline"}
                    onClick={() => setTheme(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Notifications</h3>
              <div className="flex items-center gap-2">
                <Checkbox id="email-notif" />
                <label htmlFor="email-notif" className="text-sm cursor-pointer">
                  Email
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="sms-notif" />
                <label htmlFor="sms-notif" className="text-sm cursor-pointer">
                  SMS
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="language" className="text-sm font-medium">
                Language
              </label>
              <Select>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          data-icon={saving ? "inline-start" : undefined}
        >
          {saving && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </div>

      <Dialog>
        <DialogContent>
          <DialogTitle className="sr-only">Confirm delete account</DialogTitle>
          <p>Are you sure you want to delete your account?</p>
        </DialogContent>
      </Dialog>

      {notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-10">
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      )}

      <Alert
        variant={user.verified ? "default" : "destructive"}
        className={cn(
          user.verified && "border-green-200 bg-green-50 text-green-900"
        )}
      >
        <AlertCircle className="size-4" data-icon="inline-start" />
        <AlertDescription>
          {user.verified ? "Account verified" : "Please verify your account"}
        </AlertDescription>
      </Alert>

      <Separator />

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{user.role}</Badge>
      </div>

      {saving && <Skeleton className="h-4 w-32" />}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogTitle className="sr-only">Confirm changes</DialogTitle>
          <p>Confirm changes?</p>
        </DialogContent>
      </Dialog>

      <div className="truncate">{user.longDescription}</div>
    </div>
  );
}
```

```css
/* globals.css */
@theme inline {
  --color-brand: oklch(0.7 0.15 200);
}
```
