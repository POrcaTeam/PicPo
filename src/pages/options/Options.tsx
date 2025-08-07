import { useEffect, useMemo, useState } from "react";
import "@pages/options/Options.css";
import { Label } from "@src/components/ui/label";
import { Switch } from "@src/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@src/components/ui/alert";
import { AlertOctagonIcon } from "lucide-react";

type IOptions = {
  "custom-extensions"?: string[];
  "cors-enabled"?: boolean;
};

export default function Options() {
  const onCheckedChange = async (checked: boolean) => {
    // 处理开关状态变化
    chrome.storage.local.set({ "cors-enabled": checked });
    setPrefs({ ...prefs, "cors-enabled": checked });
  };

  const [prefs, setPrefs] = useState<IOptions>();
  useEffect(() => {
    const prefs = new Promise<IOptions>((resolve) =>
      chrome.storage.local.get(
        {
          "custom-extensions": ["pdf"],
          "cors-enabled": false,
        },
        resolve
      )
    );

    prefs.then((prefs) => {
      setPrefs(prefs);
    });
  }, []);
  return (
    <div className="w-full flex">
      <div className="p-4 py-0 text-[#111111]">
        <div className="mt-0 mb-3">
          <h2 className="text-base font-medium">Custom Settings</h2>
        </div>
        <div className="grid grid-cols-1">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="airplane-mode"
                className="cursor-pointer"
                checked={prefs?.["cors-enabled"] || false}
                onCheckedChange={onCheckedChange}
              />
              <Label htmlFor="airplane-mode">
                Enabled CORS Mode
                <span className="mx-1 text-yellow-800">(Require Restart)</span>
              </Label>
            </div>
            <Alert variant="default">
              <AlertOctagonIcon />
              <AlertTitle>Bypass network CORS while searching.</AlertTitle>
              <AlertDescription>
                <p>
                  Enabling this option may cause website behavior errors. If
                  issues are detected, please disable it. Specific problems
                  include.
                </p>
                <ul className="list-inside list-disc text-sm">
                  <li>Some pages may fail to load</li>
                  <li>Some images may be missing</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </div>
  );
}
