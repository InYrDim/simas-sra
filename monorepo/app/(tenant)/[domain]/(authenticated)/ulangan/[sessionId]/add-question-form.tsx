"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { addQuestionAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="flex items-center gap-2">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Menambah Soal..." : "Tambah Soal"}
    </Button>
  )
}

export function AddQuestionForm({
  domain,
  sessionId,
}: {
  domain: string
  sessionId: string
}) {
  const [questionType, setQuestionType] = useState<string>("multiple_choice")

  return (
    <form action={addQuestionAction.bind(null, domain)} className="grid gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="space-y-1">
        <Label htmlFor="questionType">Tipe Soal</Label>
        <Select
          name="questionType"
          value={questionType}
          onValueChange={(value) => {
            if (value !== null) setQuestionType(value)
          }}
        >
          <SelectTrigger id="questionType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
            <SelectItem value="true_false">Benar / Salah</SelectItem>
            <SelectItem value="essay">Essay</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="questionText">Soal</Label>
        <Textarea id="questionText" name="questionText" placeholder="Tulis soal di sini..." rows={4} required />
      </div>

      {questionType === "multiple_choice" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="optionA">Pilihan A</Label>
            <Input id="optionA" name="optionA" placeholder="Pilihan A" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="optionB">Pilihan B</Label>
            <Input id="optionB" name="optionB" placeholder="Pilihan B" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="optionC">Pilihan C</Label>
            <Input id="optionC" name="optionC" placeholder="Pilihan C" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="optionD">Pilihan D</Label>
            <Input id="optionD" name="optionD" placeholder="Pilihan D" />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="correctAnswer">
            {questionType === "true_false" ? "Jawaban Benar" : questionType === "essay" ? "Kunci Jawaban" : "Jawaban Benar (A/B/C/D)"}
          </Label>
          {questionType === "true_false" ? (
            <Select name="correctAnswer">
              <SelectTrigger id="correctAnswer" className="w-full">
                <SelectValue placeholder="Pilih jawaban" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Benar">Benar</SelectItem>
                <SelectItem value="Salah">Salah</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input id="correctAnswer" name="correctAnswer" placeholder={questionType === "multiple_choice" ? "A" : "Kunci jawaban"} />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="points">Poin</Label>
          <Input id="points" name="points" type="number" min="1" defaultValue="1" />
        </div>
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  )
}
