/* eslint-disable @typescript-eslint/no-explicit-any */
// Central, reusable form-validation behaviour for the whole app.
//
// Before the first save attempt: a field only shows an error once it has content (live while
// typing and on blur); clearing the field hides the error again — empty fields never error.
// On save: everything is validated, including empty required fields. After that, validation
// stays live while typing.
//
// Live validation is driven by a deep watch on the form state (see `watchLive`) calling the
// form's validate() on every change — UForm's own input validation defers until a field is
// blurred, which felt dead after a save. `validateOn` is therefore '[]' (we drive it ourselves).
//
// Usage:
//   const zf = useZodForm(mySchema)
//   const formRef = ref()
//   <UForm ref="formRef" :validate="zf.validate" :validate-on="zf.validateOn" :state="state"> … </UForm>
//   zf.watchLive(formRef, state)
//   async function save() { if (!(await zf.submit(formRef.value))) return; /* …send… */ }

interface ZodLike {
  safeParse(data: unknown): {
    success: boolean
    error?: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }> }
  }
}

function isEmpty(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0)
}
function valueAtPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

export function useZodForm(schema: ZodLike) {
  const submitted = ref(false)

  function validate(state: any): { name: string; message: string }[] {
    const res = schema.safeParse(state)
    if (res.success) return []
    const errors = (res.error?.issues ?? []).map((iss) => ({
      name: iss.path.map((p) => String(p)).join('.'),
      message: iss.message,
    }))
    // Pre-submit: suppress errors for fields that are still empty.
    if (submitted.value) return errors
    return errors.filter((e) => !isEmpty(valueAtPath(state, e.name)))
  }

  // Mark the form as submitted (switch to eager validation) and run a full validation pass.
  // Returns true when valid; on failure the UForm surfaces the errors. Pass the UForm ref.
  async function submit(form: { validate: () => Promise<unknown> } | undefined): Promise<boolean> {
    submitted.value = true
    if (!form) return false
    try {
      await form.validate()
      return true
    } catch {
      return false
    }
  }

  // Re-validate the whole form on every state change (live feedback while typing). Empty fields
  // stay error-free until the first submit thanks to `validate`'s filter.
  function watchLive(form: Ref<{ validate: () => Promise<unknown> } | undefined>, state: object) {
    watch(
      () => state,
      () => {
        form.value?.validate().catch(() => {})
      },
      { deep: true },
    )
  }

  // Empty: we drive validation ourselves via watchLive + submit(), not UForm's field events.
  const validateOn: ('input' | 'blur' | 'change')[] = []
  return { validate, validateOn, submitted, submit, watchLive }
}
