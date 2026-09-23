import { useState, useEffect } from "react";
import { adminKeyHeader } from "@/lib/adminKey";
import { Loader2 } from "lucide-react";
import { useAdminKey } from "@/contexts/AdminKeyContext";

export function ImageBlob({
  candidateId,
  version,
  crop,
  className,
  alt,
}: {
  candidateId: string;
  version: number;
  crop: string;
  className?: string;
  alt?: string;
}) {
  const adminKey = useAdminKey();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    if (!adminKey) {
      setError(true);
      return;
    } else {
      setError(false);
    }

    const fetchImg = async () => {
      try {
        const res = await fetch(`/api/artwork/ui-assets/candidates/${candidateId}/v${version}/${crop}`, {
          headers: adminKeyHeader(adminKey),
        });
        if (res.ok) {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          if (mounted) setUrl(objectUrl);
        } else {
          if (mounted) setError(true);
        }
      } catch {
        if (mounted) setError(true);
      }
    };

    fetchImg();

    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [candidateId, version, crop, adminKey]);

  if (error) {
    return (
      <div className={`bg-secondary flex items-center justify-center text-[10px] text-muted-foreground ${className}`}>
        Failed
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`bg-secondary flex items-center justify-center ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
}
