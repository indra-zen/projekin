import { UserAvatar } from "@/components/profile/user-avatar";
import { SiteHeaderClient } from "@/components/site-header-client";
import { getViewer } from "@/server/auth";

export async function SiteHeader() {
  const viewer = await getViewer();
  return (
    <SiteHeaderClient
      viewer={
        viewer
          ? {
              displayName: viewer.profile.full_name ?? viewer.profile.username,
              isAdmin: viewer.isAdmin,
              avatar: (
                <UserAvatar
                  path={viewer.profile.avatar_path}
                  name={viewer.profile.full_name}
                  username={viewer.profile.username}
                  className="size-7"
                />
              ),
            }
          : null
      }
    />
  );
}
