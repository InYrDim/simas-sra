"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateSubjectCode } from "@/lib/subject-code";

export function SubjectIdentityFields({
  defaultCode = "",
  defaultName = "",
  create,
}: {
  defaultCode?: string;
  defaultName?: string;
  create: boolean;
}) {
  const [automatic, setAutomatic] = useState(create);
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(
    create ? generateSubjectCode(defaultName) : defaultCode,
  );

  function updateName(value: string) {
    setName(value);
    if (automatic) setCode(generateSubjectCode(value));
  }

  function updateAutomatic(checked: boolean) {
    setAutomatic(checked);
    if (checked) setCode(generateSubjectCode(name));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="subject-name">Nama</Label>
        <Input
          id="subject-name"
          required
          name="name"
          value={name}
          maxLength={150}
          onChange={(event) => updateName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject-code">Kode</Label>
        <Input
          id="subject-code"
          required
          name="code"
          value={code}
          maxLength={30}
          readOnly={automatic}
          onChange={(event) => setCode(event.target.value)}
        />
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox
            checked={automatic}
            onCheckedChange={(checked) => updateAutomatic(checked === true)}
          />
          Buat kode otomatis dari nama Mapel
        </Label>
      </div>
    </div>
  );
}
