import { decode as atob, encode as btoa } from "base-64";
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Button,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
} from "react-native";
import Toast,{BaseToast,ErrorToast,} from "react-native-toast-message";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { itens as dadosIniciais } from "../data/itens";
import captalize from "../utils/captalizerUpperCase";
import { StatusBar } from "expo-status-bar";

// ✅ Garantir que btoa/atob existam no escopo global
if (typeof global.btoa === "undefined") global.btoa = btoa;
if (typeof global.atob === "undefined") global.atob = atob;

// ✅ Habilitar animações no Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PlanilhaServicos() {
  const [categorias, setCategorias] = useState(dadosIniciais || []);
  const [categoriaAberta, setCategoriaAberta] = useState(null);
  const [dadosClienteAberto, setDadosClienteAberto] = useState(true);
  const [tipoGeracao, setTipoGeracao] = useState(null);
  const [gerando, setGerando] = useState(false);


  const [cliente, setCliente] = useState({
    nome: "",
    telefone: "",
    endereco: "",
  });

  const totalGeral = categorias.reduce(
    (total, cat) =>
      total +
      cat.itens.reduce((sum, item) => sum + (item.valor || 0) * (item.quantidade || 0), 0),
    0
  );

  const atualizarItem = (nomeCategoria, indexItem, campo, valorNovo) => {
    setCategorias((prev) =>
      prev.map((cat) =>
        cat.nome === nomeCategoria
          ? {
              ...cat,
              itens: cat.itens.map((item, i) =>
                i === indexItem ? { ...item, [campo]: parseFloat(valorNovo) || 0 } : item
              ),
            }
          : cat
      )
    );
  };

const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: "#28a745", backgroundColor: "#eafaf1" }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 17, fontWeight: "bold", color: "#155724" }} 
      text2Style={{ fontSize: 13, color: "#155724" }} // 🔥 aumentei de 14 → 18
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: "#f20404ff", backgroundColor: "#e7f1ff" }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 17, fontWeight: "bold", color: "#000000ff" }}
      text2Style={{ fontSize: 13, color: "#ff0404ff", fontWeight: "600" }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: "#f20404ff", backgroundColor: "#e7f1ff" }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 17, fontWeight: "bold", color: "#000000ff" }}
      text2Style={{ fontSize: 12, color: "#ff0404ff", fontWeight: "600" }}
    />
  ),
};


  // ================== FUNÇÕES ==================
  // 🧩 Gera o DOCX chamando o backend

   const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob); 
  });
};

async function gerarPDF(cliente, categorias, tipo) {
  setGerando(true); // 🔥 Liga o loading aqui

  try {
    if (!cliente.nome.trim()) {
      Toast.show({
        type: "info",
        text1: "Nome do cliente obrigatório",
        text2: "Por favor, preencha o nome antes de gerar o PDF.",
      });
      return; // ❗ precisa desligar o loading ao sair
    }

    if (totalGeral === 0) {
      Toast.show({
        type: "info",
        text1: "Orçamento vazio",
        text2: "Adicione valores antes de gerar.",
      });
      return; // ❗ precisa desligar o loading ao sair
    }

    const dados = {
      nome: cliente.nome,
      telefone: cliente.telefone || "não informado",
      endereco: cliente.endereco || "não informado",
      categorias,
      tipo,
    };

    const response = await fetch(
      "https://api-planilhadeorcamento.onrender.com/gerar-pdf",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/pdf",
        },
        body: JSON.stringify(dados),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.log("Erro backend:", response.status, text);
      throw new Error("Erro ao gerar PDF");
    }

    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const nomeArquivo =
      tipo === "cliente"
        ? "_Orcamento_Cliente.pdf"
        : "_Orcamento_Construtor.pdf";

    const pdfPath = `${FileSystem.documentDirectory}${cliente.nome}${nomeArquivo}`;

    await FileSystem.writeAsStringAsync(pdfPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await Sharing.shareAsync(pdfPath, {
      mimeType: "application/pdf",
      dialogTitle: "Orçamento gerado",
    });

    Toast.show({
      type: "success",
      text1: "PDF gerado com sucesso!",
    });
  } catch (error) {
    console.error(error);
    Toast.show({
      type: "error",
      text1: "Erro ao gerar PDF",
      text2: error.message,
    });
  } finally {
    setGerando(false); // 🔥 SEMPRE DESLIGA O LOADING
  }
}

// Conversor auxiliar de blob → base64


// 🧩 Abre/fecha categorias
 const toggleCategoria = (nome) => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setCategoriaAberta((prev) => (prev === nome ? null : nome));
};
  // 🧩 Abre/fecha dados do cliente
  const toggleDadosCliente = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDadosClienteAberto((prev) => !prev);
  };

  // 🧩 Formata o telefone automaticamente
  const formatarTelefone = (text) => {
    const apenasNumeros = text.replace(/\D/g, "");
    if (apenasNumeros.length <= 10) {
      return apenasNumeros.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }
  };

  // ================== INTERFACE ==================
  return (
    <>
    <StatusBar style="auto" />
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        <Text style={styles.titulo}>PLANILHA DE SERVIÇOS</Text>

        {/* ==== DADOS DO CLIENTE ==== */}
        <View style={styles.categoria}>
          <TouchableOpacity
            onPress={toggleDadosCliente}
            activeOpacity={0.8}
            style={[styles.tabCabecalho, dadosClienteAberto && styles.tabCabecalhoAtivo]}
          >
            <Text
              style={[styles.categoriaTitulo, dadosClienteAberto && styles.categoriaTituloAtivo]}
            >
              DADOS DO CLIENTE
            </Text>
            <Ionicons
              name={dadosClienteAberto ? "chevron-up-outline" : "chevron-down-outline"}
              size={22}
              color={dadosClienteAberto ? "#0d6efd" : "#555"}
            />
          </TouchableOpacity>

          {dadosClienteAberto && (
            <View style={styles.conteudo}>
              <View style={styles.inputGroupFull}>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  style={styles.input}
                  value={cliente.nome}
                  onChangeText={(text) => setCliente({ ...cliente, nome: captalize(text) })}
                  placeholder="Digite o nome do cliente"
                />
              </View>

              <View style={styles.inputGroupFull}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={cliente.telefone}
                  onChangeText={(text) => setCliente({ ...cliente, telefone:formatarTelefone(text) })}
                  placeholder="(00) 00000-0000"
                
                />
              </View>

              <View style={styles.inputGroupFull}>
                <Text style={styles.label}>Endereço</Text>
                <TextInput
                  style={styles.input}
                  value={cliente.endereco}
                  onChangeText={(text) => setCliente({ ...cliente, endereco: text })}
                  placeholder="Rua, número, bairro, cidade"
                />
              </View>
            </View>
          )}
        </View>

        {/* ==== CATEGORIAS ==== */}
        <FlatList
          data={categorias}
          keyExtractor={(item) => item.nome}
          scrollEnabled={false}
          renderItem={({ item: cat }) => {
            const aberta = categoriaAberta === cat.nome;
            return (
              <View style={styles.categoria}>
                <TouchableOpacity
                  onPress={() => toggleCategoria(cat.nome)}
                  activeOpacity={0.8}
                  style={[styles.tabCabecalho, aberta && styles.tabCabecalhoAtivo]}
                >
                  <Text style={[styles.categoriaTitulo, aberta && styles.categoriaTituloAtivo]}>
                    {cat.nome}
                  </Text>
                  <Ionicons
                    name={aberta ? "chevron-up-outline" : "chevron-down-outline"}
                    size={22}
                    color={aberta ? "#0d6efd" : "#555"}
                  />
                </TouchableOpacity>

                {aberta && (
                  <View style={styles.conteudo}>
                    {cat.itens.map((item, index) => (
                      <View key={index} style={styles.card}>
                        <Text style={styles.descricao}>{item.descricao}</Text>
                        <Text style={styles.unidade}>Unidade: {item.unid}</Text>
                        <Text style={styles.limites}>
                          Valor mínimo: R$ {(item.valorMin ?? 0).toFixed(2)} | Valor máximo: R${" "}
                          {(item.valorMax ?? 0).toFixed(2)}
                        </Text>
                        <Text style={styles.limites}>
                        <Text style={{fontWeight: "bold"}}> {item.observacoes} </Text>
                        </Text>
                       
                        <View style={styles.inputsRow}>
                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Valor (R$)</Text>
                            <TextInput
                              style={styles.input}
                              keyboardType="numeric"
                              value={item.valor?.toString() ?? ""}
                              onChangeText={(text) =>
                                atualizarItem(cat.nome, index, "valor", text)
                              }
                            />
                          </View>

                          <View style={styles.inputGroup}>
                            <Text style={styles.label}>Quantidade</Text>
                            <TextInput
                              style={styles.input}
                              keyboardType="numeric"
                              value={item.quantidade?.toString() ?? ""}
                              onChangeText={(text) =>
                                atualizarItem(cat.nome, index, "quantidade", text)
                              }
                            />
                          </View>
                        </View>

                        <Text style={styles.subtotal}>
                          Subtotal: R$ {((item.valor ?? 0) * (item.quantidade ?? 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />

        <Text style={styles.totalTexto}>TOTAL GERAL: {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Text>

        {/* SELEÇÃO DE TIPO */}
    <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 12 }}>
      
      {/* Cliente */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => setTipoGeracao(tipoGeracao === "cliente" ? null : "cliente")}
      >
        <Ionicons
          name={tipoGeracao === "cliente" ? "checkbox-outline" : "square-outline"}
          size={36}
          color="#0d6efd"
        />
        <Text style={styles.checkboxLabel}>Cliente</Text>
      </TouchableOpacity>

      {/* Construtor */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() => setTipoGeracao(tipoGeracao === "construtor" ? null : "construtor")}
      >
        <Ionicons
          name={tipoGeracao === "construtor" ? "checkbox-outline" : "square-outline"}
          size={36}
          color="#28a745"
        />
        <Text style={styles.checkboxLabel}>Construtor</Text>
      </TouchableOpacity>

    </View>

    {/* BOTÃO GERAR PDF */}
    <View style={{ padding: 15 }}>
      <Button
        title={gerando ? "Gerando..." : "Gerar PDF"}
        color="#0d6efd"
        onPress={async () => {

        if (!tipoGeracao) {
          Toast.show({
            type: "info",
            text1: "Selecione Cliente ou Construtor",
          });
          return;
        }
        await gerarPDF(cliente, categorias, tipoGeracao);
      }}
      />
    </View>
      </ScrollView>
      <Text style={{ textAlign: "center", fontSize: 12, color: "#888", marginTop: 8 }}>
        Desenvolvido por EliteSupportTI
      </Text>
    </SafeAreaView>
    <Toast config={toastConfig} position="top" topOffset={50} />

    </>
  );
}

// === ESTILOS ===
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f2f4f8", padding: 16 },
  titulo: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#020202ff",
  },
  categoria: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabCabecalho: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e9ecef",
    padding: 12,
    borderRadius: 12,
  },
  tabCabecalhoAtivo: {
    backgroundColor: "#e7f0ff",
    borderColor: "#0d6efd",
    borderWidth: 1,
  },
  categoriaTitulo: {
    fontSize: 17,
    fontWeight: "600",
    color: "#333",
  },
  categoriaTituloAtivo: {
    color: "#0d6efd",
  },
  conteudo: {
    marginTop: 4,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#d0d7de",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  card: {
    backgroundColor: "#fdfdfd",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
  descricao: { fontSize: 16, fontWeight: "500", color: "#333" },
  unidade: { fontSize: 13, color: "#666", marginBottom: 4 },
  limites: { fontSize: 12, color: "#555", marginBottom: 6 },
  inputsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
    flexWrap: "wrap",
  },
  inputGroup: { flex: 1, marginHorizontal: 4, minWidth: 80 },
  inputGroupFull: { marginVertical: 6 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    backgroundColor: "#fafafa",
  },
  subtotal: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "right",
    color: "#198754",
    marginTop: 8,
  },
  totalTexto: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 12,
    color: "#0d6efd",
  },
  checkboxContainer: {
  flexDirection: "row",
  alignItems: "center",
},
checkboxLabel: {
  marginLeft: 6,
  fontSize: 16,
  fontWeight: "500",
  color: "#333",
}

});
