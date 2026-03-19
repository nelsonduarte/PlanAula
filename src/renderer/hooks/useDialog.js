import { useState } from 'react'

export function useDialog() {
  const [dialog, setDialog] = useState(null)

  function confirm(message, { title = 'Confirmação', danger = false } = {}) {
    return new Promise(resolve => {
      setDialog({ title, message, type: 'confirm', danger, resolve })
    })
  }

  function alert(message, { title = 'Aviso', type = 'warning' } = {}) {
    return new Promise(resolve => {
      setDialog({ title, message, type, resolve })
    })
  }

  function handleOk() {
    dialog?.resolve(true)
    setDialog(null)
  }

  function handleCancel() {
    dialog?.resolve(false)
    setDialog(null)
  }

  return { confirm, alert, dialog, handleOk, handleCancel }
}
