# vanilla-wrap-balancer

> [**react-wrap-balancer**](https://github.com/shuding/react-wrap-balancer)를 의존성·프레임워크 없이 포팅했습니다. 평범한 HTML 페이지에 `<script>` 한 줄만 넣으면, 제목 마지막 줄에 단어 하나만 덩그러니 떨어지는 일이 사라집니다.

🇺🇸 English: [README.md](./README.md)

![vanilla-wrap-balancer 데모 — 한국어, 기본 줄바꿈 vs 균형](./.github/demo.gif)

<sub>같은 문장·같은 너비 — **기본 줄바꿈**은 마지막 줄에 한 단어만 덩그러니 남기지만, **vanilla-wrap-balancer**는 줄 길이를 고르게 맞춥니다. (한국어 `word-break: keep-all`)</sub>

핵심 이진 탐색 알고리즘(`relayout`)은 react-wrap-balancer(MIT © Shu Ding)에서 **한 글자도 바꾸지 않고 그대로** 가져왔습니다. 이 패키지는 그동안 React가 대신 해주던 부분 — 고유 id 생성, 인라인 스타일 적용, 네이티브 기능 감지, "내용이 바뀌면 다시 균형 잡기", 옵저버 정리 — 만 바닐라로 다시 구현했습니다. 그래서 빌드 과정도, 프레임워크도 필요 없습니다.

- ✅ **압축 시 약 3.8 KB**, 의존성 0
- ✅ 일반 `<script>` 태그로 동작 → 전역 `WrapBalancer` 노출 (UMD)
- ✅ `[data-br-balance]` 요소 자동 초기화 + 간단한 프로그래밍 API
- ✅ 네이티브 CSS `text-wrap: balance`를 우선 사용하고, 없으면 JS 이진 탐색으로 처리
- ✅ 컨테이너 크기 변화(`ResizeObserver`), 내용 변화(`MutationObserver`)에 자동 재배치
- ✅ React 원본과 **바이트 단위로 동일함을 644개 무작위 케이스로 증명** — [등가성 및 테스트](#등가성-및-테스트) 참고

---

## 어떤 문제를 푸나요?

제목이 줄바꿈될 때 브라우저는 각 줄을 욕심껏 채우기 때문에, 마지막 줄에 단어 하나만 남는 경우가 자주 생깁니다.

```
멋진 제목을 모든 화면에서
읽기 좋게
만들어 보세요              ← 외톨이 단어
```

균형을 잡으면 모든 줄의 너비가 비슷해지도록 단어를 다시 배분합니다.

```
멋진 제목을
모든 화면에서 읽기 좋게
만들어 보세요              ← 균형 잡힌 줄바꿈
```

---

## 설치

### 방법 A — `<script>` 태그 (일반 HTML 페이지에 권장)

**jsDelivr CDN**에서 바로 불러옵니다 — 설치도 빌드도 필요 없습니다.

```html
<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js"></script>
```

`@main`은 항상 최신 커밋을 제공합니다 (jsDelivr가 GitHub를 미러링). 직접 호스팅하려면 `wrap-balancer.min.js`를 내려받아 로컬에서 불러오세요.

```html
<script src="wrap-balancer.min.js"></script>
```

### 방법 B — ES 모듈 / 번들러

UMD 파일은 `module.exports`도 노출하므로 번들러에서 import할 수 있습니다.

```js
import WrapBalancer from './wrap-balancer.js'
WrapBalancer.balance('.title')
```

네이티브 `<script type="module">`에서는 파일이 부수효과로 전역을 등록합니다.

```html
<script type="module">
  import './wrap-balancer.js'
  WrapBalancer.balance('.title')
</script>
```

---

## 빠른 시작 (코드 작성 불필요)

텍스트 요소에 `data-br-balance`만 붙이면 됩니다. 로드 시점, 웹폰트 로딩 완료 후, 그리고 크기가 바뀔 때마다 자동으로 균형을 잡습니다.

```html
<h1 data-br-balance>The quick brown fox jumps over the lazy dog tonight</h1>

<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js"></script>
```

연동은 이게 전부입니다. [`examples/01-quickstart.html`](./examples/01-quickstart.html)을 참고하세요.

> **팁 — 마커는 어디에 다나요.** `data-br-balance`는 텍스트를 *담고 있는* 요소(예: `<h1>`)에 답니다. 라이브러리는 그 요소의 자식들을 inline-block `<span>`으로 감싸고 그 span을 안에서 균형 잡습니다. React의 `<h1><Balancer>…</Balancer></h1>` 구조와 똑같습니다.

---

## 사용 패턴

| 패턴 | 파일 |
|---|---|
| 코드 없는 자동 초기화 | [`examples/01-quickstart.html`](./examples/01-quickstart.html) |
| 프로그래밍 API | [`examples/02-programmatic.html`](./examples/02-programmatic.html) |
| 균형 비율 슬라이더 | [`examples/03-ratio.html`](./examples/03-ratio.html) |
| 동적 콘텐츠 | [`examples/04-dynamic.html`](./examples/04-dynamic.html) |
| 적용 전/후 비교 | [`examples/05-comparison.html`](./examples/05-comparison.html) |

### 프로그래밍 방식

`data-auto="false"`로 자동 초기화를 끄고 직접 호출합니다.

```html
<script src="https://cdn.jsdelivr.net/gh/Mineru98/vanilla-wrap-balancer@main/wrap-balancer.min.js" data-auto="false"></script>
<script>
  const handles = WrapBalancer.balance('.title', { ratio: 1, preferNative: true })
  // handles[0].rebalance()
  // handles[0].destroy()
</script>
```

### 요소별 옵션은 data 속성으로

```html
<h1 data-br-balance data-br-ratio="0.75" data-br-prefer-native="false">…</h1>
```

---

## API

전역 `WrapBalancer` 객체:

### `WrapBalancer.balance(target, options?) → handle[]`

요소 하나 또는 여럿의 균형을 잡습니다. `target`은 CSS 선택자 문자열, `Element`, `NodeList`, 요소 배열 중 무엇이든 됩니다. 멱등(idempotent)이라 같은 요소에 다시 호출해도 옵션만 갱신하고 다시 균형을 잡을 뿐 이중으로 감싸지 않습니다. [핸들](#핸들) 배열을 반환합니다.

```js
WrapBalancer.balance('h1.title')
WrapBalancer.balance(document.querySelector('#hero'), { ratio: 0.5 })
WrapBalancer.balance(document.querySelectorAll('.card h2'))
```

### `WrapBalancer.balanceAll(options?) → handle[]`

선택자(기본값 `[data-br-balance]`)에 맞는 모든 요소의 균형을 잡습니다.

```js
WrapBalancer.balanceAll()
WrapBalancer.balanceAll({ selector: '.balance-me', ratio: 1 })
```

### `WrapBalancer.rebalanceAll(selector?)`

현재 관리 중인 모든 요소를 다시 균형 잡습니다. (옵저버가 감지하지 못하는 레이아웃 변경 후 등에 사용)

### `WrapBalancer.isNativeSupported() → boolean`

브라우저가 네이티브 CSS `text-wrap: balance`를 지원하면 `true` (결과 캐시됨).

### `WrapBalancer.relayout(id, ratio, wrapper)`

react-wrap-balancer에서 그대로 가져온 저수준 알고리즘입니다. 보통 직접 호출할 일은 없고 `balance()`가 대신 호출합니다.

### 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `ratio` | `number` (0~1) | `1` | `0` = 브라우저 기본, `1` = 가장 촘촘한 균형. |
| `preferNative` | `boolean` | `true` | 지원되면 네이티브 CSS `text-wrap: balance`를 쓰고 JS 경로를 건너뜀. |
| `wrap` | `boolean` | `true` | `true`: 요소의 자식을 inline-block span으로 감쌈(요소=컨테이너). `false`: 요소 자체를 wrapper로 취급(부모=컨테이너). |
| `selector` | `string` | `[data-br-balance]` | (`balanceAll` 전용) 균형 잡을 요소. |

### data 속성

| 속성 | 대응 옵션 |
|---|---|
| `data-br-balance` | 자동 초기화 대상 표시 |
| `data-br-ratio="0.5"` | `ratio` |
| `data-br-prefer-native="false"` | `preferNative` |
| `data-br-wrap="false"` | `wrap` |
| `data-auto="false"` *(`<script>` 태그에)* | 자동 초기화 전체 끄기 |

### 핸들

`balance()`는 요소마다 핸들 하나를 반환합니다.

```ts
{
  element,        // 대상으로 지정한 요소 (컨테이너)
  wrapper,        // max-width가 조정되는 inline-block <span>
  id,             // 생성된 data-br id
  ratio, preferNative, usingNative,
  rebalance(),    // 지금 다시 계산
  destroy(),      // 옵저버 해제, max-width 초기화
}
```

---

## 동작 원리

1. **감싸기.** 대상 요소의 자식들을 inline-block `<span>`(*wrapper*) 안으로 옮깁니다. 요소 자체는 *컨테이너*가 됩니다.
2. **이진 탐색.** `relayout`은 wrapper의 `max-width`를 이진 탐색으로 줄여, **줄 수가 늘어나지 않는 가장 좁은 너비**(즉 `container.clientHeight`가 그대로인 지점)를 찾습니다. 그다음 `ratio`로 그 촘촘한 너비와 전체 컨테이너 너비 사이를 보간합니다.
3. **계속 균형 유지.** 컨테이너의 `ResizeObserver`가 크기 변화 시 다시 균형을 잡고, wrapper의 `MutationObserver`가 텍스트 변화 시 다시 균형을 잡습니다.
4. **네이티브 우선.** `preferNative`가 켜져 있고 브라우저가 `text-wrap: balance`를 지원하면 JS를 아예 건너뛰고 브라우저(CSS)에 맡깁니다.

이 알고리즘은 **결정적(deterministic)**입니다. 컨테이너 너비·텍스트·비율이 같으면 항상 같은 `max-width`가 나옵니다. 바로 이 성질 덕분에 React 원본과의 바이트 단위 등가성을 테스트로 증명할 수 있습니다.

---

## react-wrap-balancer에서 넘어오기

| react-wrap-balancer (React) | vanilla-wrap-balancer |
|---|---|
| `<Balancer>text</Balancer>` | `<h1 data-br-balance>text</h1>` 또는 `WrapBalancer.balance(el)` |
| `ratio` prop | `ratio` 옵션 / `data-br-ratio` |
| `preferNative` prop | `preferNative` 옵션 / `data-br-prefer-native` |
| `as` prop | 원하는 태그를 직접 사용; 그 요소를 바로 균형 잡으려면 `wrap:false` |
| `<Provider>` | 불필요 — 전역이 하나뿐 |
| `nonce` prop | 불필요 — 런타임에 인라인 스크립트를 주입하지 않음 |
| `children` 변경 시 재배치 | `MutationObserver` (자동) |
| 언마운트 정리 | `handle.destroy()` |

wrapper 인라인 스타일(`display:inline-block; vertical-align:top; text-decoration:inherit; text-wrap:…`)과 `data-br` / `data-brr` 속성이 react-wrap-balancer의 출력과 같은 *모양*의 DOM을 만듭니다.

> **SSR 상호운용 (둘을 섞어 쓴다면 읽어보세요).** react-wrap-balancer의 서버 렌더링 마크업은 자체 인라인 `<script>`(`self.__wrap_b`를 정의하고 호출)로 **스스로** 균형을 잡습니다. 따라서 이 라이브러리가 필요 없으며, 이 라이브러리도 그 `data-br` span을 **흡수하지 않습니다**(자동 초기화는 `data-br`가 아니라 `[data-br-balance]`를 대상으로 하고, `self.__wrap_b`를 정의하지 않습니다). 둘은 정신적으로는 호환되지만 **런타임 와이어 수준에서는 호환되지 않습니다** — 요소마다 하나만 고르세요. 둘이 함께 있어도 충돌(크래시)은 없으며 서로를 무시합니다.

---

## 등가성 및 테스트

`relayout`이 결정적이므로 등가성은 말로 때우는 게 아니라 **증명**할 수 있습니다. [`test/equivalence.html`](./test/equivalence.html)의 하니스는 바이트 단위로 동일한 DOM을 다음 둘에 입력합니다.

- react-wrap-balancer **원본** `relayout` (upstream [react-wrap-balancer](https://github.com/shuding/react-wrap-balancer)에서 그대로 전사, 하니스 안에 포함), 그리고
- **바닐라** `WrapBalancer.relayout` / 고수준 `balance()`

컨테이너 너비 7종 × 비율 5종 × 다수의 무작위 제목에 대해 결과 `max-width`가 **바이트 단위로 동일한지** 검증합니다.

**결과: 644 / 644 케이스 바이트 동일** (그중 543건에서 `scrollWidth` 클램프 분기 발동; 동작 31/31; min 동등성 144/144). 전체 등가성 기준은 [`test/rubric.md`](./test/rubric.md)의 루브릭을 참고하세요.

로컬 실행:

```bash
cd vanilla
python3 -m http.server 8771
# http://localhost:8771/test/equivalence.html 열기 — 배너에 PASS/FAIL이 표시되고
# window.__RESULTS__에 기계가 읽을 수 있는 요약이 담깁니다.
```

---

## 브라우저 지원

react-wrap-balancer와 동일합니다. JS 경로에는 `ResizeObserver`가 필요합니다.

| Chrome/Edge | Safari | Firefox | Opera |
|:---:|:---:|:---:|:---:|
| 64+ | 13.1+ | 69+ | 51+ |

네이티브 `text-wrap: balance`를 지원하는 브라우저는 (`preferNative`가 켜져 있으면) JS를 아예 건너뜁니다. 더 오래된 브라우저는 [`ResizeObserver` 폴리필](https://github.com/que-etc/resize-observer-polyfill)을 추가하세요.

---

## 라이선스

MIT. 핵심 알고리즘 © [Shu Ding](https://github.com/shuding) (react-wrap-balancer). 바닐라 포팅은 이 fork에서 관리합니다.
