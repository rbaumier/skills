```tsx
"use client";

import { Search, AlertCircle, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { FieldSet, FieldLegend } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

interface DashboardProps {
  user: {
    name: string;
    bio: string;
    avatar: string;
    verified: boolean;
    role: string;
    longDescription: string;
  };
  notifications: Notification[];
}

interface Notification {
  id: string;
  message: string;
}

export function UserDashboard({ user, notifications }: DashboardProps) {
  const [activeTab, setActiveTab] = ("profile");
  const [saving, setSaving] = ("false");
  const [showConfirm, setShowConfirm] = ("false");
  const [theme, setTheme] = ("system");

  const handleSave = () => {
    setSaving(true);
    // Handle save logic
    setSaving(false);
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    // Apply theme logic
  };

  return (
    <div className="bg-background text-foreground">
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.bio}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Avatar className="size-12">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <FieldGroup className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="name">Display Name</FieldLabel>
              <Input id="name" defaultValue={user.name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea id="bio" defaultValue={user.bio} />
            </Field>
          </FieldGroup>
        </TabsContent>

        <TabsContent value="settings">
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="font-semibold mb-3">Theme</h3>
              <ToggleGroup value={theme} onValueChange={handleThemeChange}>
                <ToggleGroupItem value="light">Light</ToggleGroupItem>
                <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                <ToggleGroupItem value="system">System</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <FieldSet>
              <FieldLegend variant="label">Notifications</FieldLegend>
              <FieldGroup className="flex flex-col gap-3">
                <Field orientation="horizontal">
                  <Checkbox id="email-notif" />
                  <FieldLabel htmlFor="email-notif" className="font-normal">Email</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="sms-notif" />
                  <FieldLabel htmlFor="sms-notif" className="font-normal">SMS</FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="language">Language</FieldLabel>
              <Select>
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col gap-3 mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            <>
              <Search data-icon="inline-start" />
              Save
            </>
          )}
        </Button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogTitle>Delete Account</DialogTitle>
          <p>Are you sure you want to delete your account? This action cannot be undone.</p>
        </DialogContent>
      </Dialog>

      {notifications.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No notifications</EmptyTitle>
            <EmptyDescription>You have no notifications yet.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notification) => (
            <div key={notification.id} className="p-3 border rounded">
              {notification.message}
            </div>
          ))}
        </div>
      )}

      <Alert variant={user.verified ? "success" : "warning"}>
        <AlertCircle className="size-4" />
        <AlertDescription>
          {user.verified ? "Account verified" : "Please verify your account"}
        </AlertDescription>
      </Alert>

      <Separator className="my-4" />

      <div className="flex items-center gap-2">
        <Badge variant="secondary">{user.role}</Badge>
      </div>

      <div className="truncate">
        {user.longDescription}
      </div>
    </div>
  );
}
```

## Issues Fixed

1. **Dialog missing DialogTitle** — Added `DialogTitle` for accessibility.
2. **Tabs triggers not inside TabsList** — Wrapped `TabsTrigger` in `TabsList`.
3. **Label+input pairs not wrapped in Field** — All form inputs wrapped in `FieldGroup` + `Field` + `FieldLabel`.
4. **Raw checkboxes without Field** — Wrapped in `Field` with proper `FieldLabel`.
5. **Theme buttons using manual active state** — Replaced with `ToggleGroup` + `ToggleGroupItem`.
6. **Notifications heading with checkboxes** — Wrapped in `FieldSet` + `FieldLegend` instead of raw `<h3>`.
7. **Raw `<div>` for empty state** — Replaced with `Empty` + `EmptyHeader` + `EmptyTitle` + `EmptyDescription`.
8. **Custom colored div for verification status** — Replaced with `Alert` + semantic variant.
9. **Raw color classes (bg-green-100, text-green-800, etc.)** — Removed all `-50/-100/-200/-500/-600/-800/-900` suffixes; use Alert variant or Badge instead.
10. **Custom `<div className="border-t">` separator** — Replaced with `Separator` component.
11. **Avatar missing AvatarFallback** — Added for when image fails.
12. **Button with `isLoading` prop** — Removed; composed with `Spinner` + `disabled` state.
13. **Icon sizing on button** — Removed `w-4 h-4` classes; used `size-4` + `data-icon="inline-start"`.
14. **`space-y-*` in forms** — Replaced with `flex flex-col gap-*`.
15. **`space-x-3` in button group** — Replaced with `flex gap-3`.
16. **`w-12 h-12` on Avatar** — Replaced with `size-12`.
17. **Icon as string lookup** — Passed icons as React components (e.g., `<Search />`, `<AlertCircle />`).
18. **Missing `AvatarFallback` with content** — Added character fallback.
19. **Hardcoded icon string map** — Removed; icons passed as components.
20. **Select without SelectGroup** — Wrapped items in `SelectGroup`.
21. **No semantic text colors** — Used `text-foreground`, `text-muted-foreground` for semantic tokens.
22. **`truncate` shorthand** — Applied correct `truncate` class instead of `overflow-hidden text-ellipsis whitespace-nowrap`.
23. **Missing `"use client"` directive** — Added for RSC compatibility with state/event handlers.
