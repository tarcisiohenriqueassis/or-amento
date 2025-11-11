export default function capitalizeWords(str) {
  return str
    .toLowerCase() // tudo minúsculo primeiro
    .split(' ')    // separa por espaços
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // maiúscula só a 1ª letra
    .join(' ');    // junta tudo de volta em string
}


