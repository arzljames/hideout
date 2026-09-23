import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const joinSchema = z.object({
  displayName: z.string().trim().min(2, 'At least 2 characters').max(32, 'At most 32 characters'),
})

type JoinValues = z.infer<typeof joinSchema>

export function JoinForm() {
  const form = useForm<JoinValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { displayName: '' },
  })

  function onSubmit(values: JoinValues) {
    toast.success(`Welcome, ${values.displayName}`)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Hideout</CardTitle>
        <CardDescription>Pick a display name to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="displayName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Display name</FieldLabel>
                  <Input {...field} id={field.name} aria-invalid={fieldState.invalid} autoComplete="off" />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Button type="submit">Continue</Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
