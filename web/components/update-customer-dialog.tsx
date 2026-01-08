'use client'

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Pencil, Loader2 } from "lucide-react"
import { useState, useTransition, useEffect } from "react"
import { updateCustomer } from "@/app/actions/update-customer"
import { toast } from "sonner"

// Interface define que podemos receber um botão personalizado (children)
interface UpdateCustomerDialogProps {
  customer: any
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode 
}

export function UpdateCustomerDialog({ 
  customer, 
  open: controlledOpen, 
  onOpenChange,
  children 
}: UpdateCustomerDialogProps) {
  
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  // Lógica para funcionar tanto controlado (pelo pai) quanto autônomo
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [isActive, setIsActive] = useState(customer.active !== false)

  // -- States --
  const [dateMask, setDateMask] = useState("")
  const [cep, setCep] = useState("")
  const [street, setStreet] = useState("")
  const [number, setNumber] = useState("")
  const [district, setDistrict] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [loadingCep, setLoadingCep] = useState(false)

  // Popula dados ao abrir
  useEffect(() => {
    if (open) {
      // 1. Data
      if (customer.birth_date) {
        const [year, month, day] = new Date(customer.birth_date).toISOString().split('T')[0].split('-')
        setDateMask(`${day}/${month}/${year}`)
      } else {
        setDateMask("")
      }

      // 2. Endereço (Tenta ler o formato padrão)
      const addr = customer.address || ""
      if (addr) {
         const regex = /^(.*),\s*(\d+|S\/N)\s*-\s*(.*),\s*(.*)\/(.*)\s*-\s*CEP:\s*(.*)$/i
         const match = addr.match(regex)
         if (match) {
            setStreet(match[1] || ""); setNumber(match[2] || ""); setDistrict(match[3] || ""); setCity(match[4] || ""); setState(match[5] || ""); setCep(match[6] || "")
         } else {
            setStreet(addr); setNumber(""); setDistrict(""); setCity(""); setState(""); setCep("")
         }
      } else {
        setStreet(""); setNumber(""); setDistrict(""); setCity(""); setState(""); setCep("")
      }
    }
  }, [open, customer])

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '')
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2')
    if (v.length > 4) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
    if (v.length > 10) v = v.substring(0, 10)
    setDateMask(v)
  }

  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return
    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setStreet(data.logradouro); setDistrict(data.bairro); setCity(data.localidade); setState(data.uf)
        setTimeout(() => document.getElementById('upd-number')?.focus(), 100)
      }
    } catch { toast.error("Erro no CEP.") } finally { setLoadingCep(false) }
  }

  async function handleSubmit(formData: FormData) {
    if (dateMask) {
      const parts = dateMask.split('/')
      if (parts.length === 3) formData.set('birth_date', `${parts[2]}-${parts[1]}-${parts[0]}`)
    }
    if (street || city) {
      const fullAddress = `${street}, ${number || 'S/N'} - ${district}, ${city}/${state} - CEP: ${cep}`
      formData.set('address', fullAddress)
    }

    startTransition(async () => {
      const result = await updateCustomer(formData)
      if (result.success) {
        toast.success("Atualizado!")
        setOpen(false)
      } else {
        toast.error("Erro ao atualizar.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* SEGREDO: Se passar 'children' usa ele, senão usa o ícone padrão */}
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {children ? children : (
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </DialogTrigger>
      )}
      
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Atualize os dados cadastrais.</DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit} className="space-y-4 py-4">
          <input type="hidden" name="id" value={customer.id} />
          
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
                <Label>Cadastro Ativo</Label>
                <p className="text-xs text-muted-foreground">Desative para ocultar.</p>
            </div>
            <Switch name="active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
                <Label htmlFor="upd-name">Nome *</Label>
                <Input id="upd-name" name="name" defaultValue={customer.name} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="upd-phone">WhatsApp *</Label>
                <Input id="upd-phone" name="phone" defaultValue={customer.phone} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="upd-birth">Nascimento</Label>
                <Input id="upd-birth" value={dateMask} onChange={handleDateChange} placeholder="DD/MM/AAAA" maxLength={10} />
            </div>
            <div className="space-y-2 col-span-2">
                <Label htmlFor="upd-email">E-mail</Label>
                <Input id="upd-email" name="email" type="email" defaultValue={customer.email} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="upd-doc">CPF</Label>
                <Input id="upd-doc" name="document" defaultValue={customer.document} />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
            <div className="grid grid-cols-4 gap-3">
               <div className="col-span-1 space-y-1">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input value={cep} onChange={(e) => setCep(e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
                    {loadingCep && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-primary"/>}
                  </div>
               </div>
               <div className="col-span-3 space-y-1"><Label>Rua</Label><Input value={street} onChange={e => setStreet(e.target.value)} /></div>
               <div className="col-span-1 space-y-1"><Label>Nº</Label><Input id="upd-number" value={number} onChange={e => setNumber(e.target.value)} /></div>
               <div className="col-span-3 space-y-1"><Label>Bairro</Label><Input value={district} onChange={e => setDistrict(e.target.value)} /></div>
               <div className="col-span-3 space-y-1"><Label>Cidade</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
               <div className="col-span-1 space-y-1"><Label>UF</Label><Input value={state} onChange={e => setState(e.target.value)} maxLength={2} /></div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="upd-notes">Observações</Label>
            <Textarea id="upd-notes" name="notes" defaultValue={customer.notes} rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || loadingCep}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}