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
import { PlusCircle, Loader2, Search } from "lucide-react"
import { useState, useTransition } from "react"
import { createCustomer } from "@/app/actions/create-customer"
import { toast } from "sonner"
import { useKeckleon } from "@/providers/keckleon-provider"

export function CreateCustomerDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const { dict } = useKeckleon()
  
  // States para os campos controlados (Máscaras e CEP)
  const [dateMask, setDateMask] = useState("")
  
  // States de Endereço
  const [cep, setCep] = useState("")
  const [street, setStreet] = useState("")
  const [number, setNumber] = useState("")
  const [district, setDistrict] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [loadingCep, setLoadingCep] = useState(false)

  // Máscara de Data (DD/MM/AAAA)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '')
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2')
    if (v.length > 4) v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
    if (v.length > 10) v = v.substring(0, 10)
    setDateMask(v)
  }

  // Busca CEP (ViaCEP)
  const handleCepBlur = async () => {
    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) return

    setLoadingCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setStreet(data.logradouro)
        setDistrict(data.bairro)
        setCity(data.localidade)
        setState(data.uf)
        // Foca no número após carregar
        document.getElementById('number')?.focus()
      } else {
        toast.error("CEP não encontrado.")
      }
    } catch (error) {
      toast.error("Erro ao buscar CEP.")
    } finally {
      setLoadingCep(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    // 1. Converter Data (DD/MM/AAAA -> YYYY-MM-DD)
    if (dateMask) {
      const [day, month, year] = dateMask.split('/')
      if (day && month && year && year.length === 4) {
        formData.set('birth_date', `${year}-${month}-${day}`)
      } else {
        toast.error("Data de nascimento inválida.")
        return
      }
    }

    // 2. Concatenar Endereço Padronizado
    // Formato: Rua X, 123 - Bairro, Cidade/UF - CEP: 00000-000
    if (street || city) {
      const fullAddress = `${street}, ${number} - ${district}, ${city}/${state} - CEP: ${cep}`
      formData.set('address', fullAddress)
    }

    startTransition(async () => {
      const result = await createCustomer(formData)
      if (result.success) {
        toast.success("Cliente cadastrado com sucesso!")
        setOpen(false)
        // Reset states
        setDateMask("")
        setCep(""); setStreet(""); setNumber(""); setDistrict(""); setCity(""); setState("")
      } else {
        toast.error("Erro ao cadastrar cliente.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Novo {dict.label_cliente}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo {dict.label_cliente}</DialogTitle>
          <DialogDescription>
            Preencha os dados completos. Use o CEP para preencher o endereço automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        <form action={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" name="name" required placeholder="Ex: Maria Silva" />
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp *</Label>
                <Input id="phone" name="phone" required placeholder="Ex: 11999999999" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="birth_date_mask">Nascimento (DD/MM/AAAA)</Label>
                <Input 
                  id="birth_date_mask" 
                  value={dateMask} 
                  onChange={handleDateChange} 
                  placeholder="01/01/1980" 
                  maxLength={10}
                />
            </div>

            <div className="space-y-2 col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" placeholder="cliente@email.com" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="document">CPF</Label>
                <Input id="document" name="document" placeholder="000.000.000-00" />
            </div>
          </div>

          {/* SESSÃO DE ENDEREÇO */}
          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-medium text-muted-foreground">Endereço</h3>
            
            <div className="grid grid-cols-4 gap-3">
               <div className="col-span-1 space-y-1">
                  <Label htmlFor="cep">CEP</Label>
                  <div className="relative">
                    <Input 
                        id="cep" 
                        value={cep} 
                        onChange={(e) => setCep(e.target.value)} 
                        onBlur={handleCepBlur}
                        placeholder="00000-000"
                    />
                    {loadingCep && <div className="absolute right-2 top-2.5"><Loader2 className="h-4 w-4 animate-spin text-primary"/></div>}
                  </div>
               </div>
               <div className="col-span-3 space-y-1">
                  <Label htmlFor="street">Rua / Logradouro</Label>
                  <Input id="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Rua das Flores" />
               </div>
               
               <div className="col-span-1 space-y-1">
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" value={number} onChange={e => setNumber(e.target.value)} placeholder="123" />
               </div>
               <div className="col-span-3 space-y-1">
                  <Label htmlFor="district">Bairro</Label>
                  <Input id="district" value={district} onChange={e => setDistrict(e.target.value)} placeholder="Centro" />
               </div>

               <div className="col-span-3 space-y-1">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="São Paulo" />
               </div>
               <div className="col-span-1 space-y-1">
                  <Label htmlFor="state">UF</Label>
                  <Input id="state" value={state} onChange={e => setState(e.target.value)} placeholder="SP" maxLength={2} />
               </div>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="notes">Observações Internas</Label>
            <Textarea id="notes" name="notes" placeholder="Alergias, preferências, histórico..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || loadingCep}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}