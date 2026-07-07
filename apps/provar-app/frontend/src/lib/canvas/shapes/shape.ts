import { Container, Graphics, Text } from 'pixi.js';
import { COLOURS, LAYOUT, TYPOGRAPHY, type ActionState } from '../constants';

const UNCOMPILED_NODE_OPACITY = 0.8;

export class NodeShape extends Container {
  protected bg: Graphics;
  protected iconRow: Container;
  public readonly nodeId: string;

  private isCompiledFlag: boolean = false;
  private borderWidth = 0;
  private borderHeight = 0;

  protected get cornerRadius(): number {
    return 8;
  }
  protected get fontSize(): number {
    return 13;
  }
  protected get paddingX(): number {
    return 14;
  }
  protected get paddingY(): number {
    return 11;
  }
  protected get minWidth(): number {
    return 180;
  }

  public get nodeWidth(): number {
    return this.bg.width;
  }

  public get nodeHeight(): number {
    return this.bg.height;
  }

  constructor(
    nodeId: string,
    title: string,
    description: string = '',
    state: ActionState = 'idle',
    onActivePath: boolean = false,
    isCompiled: boolean = false,
  ) {
    super();
    this.nodeId = nodeId;
    this.isCompiledFlag = isCompiled;

    this.bg = new Graphics();
    this.addChild(this.bg);

    const hasDescription = description.trim().length > 0;

    const titleText = new Text({
      text: title,
      style: {
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: this.fontSize,
        fontWeight: '500',
        lineHeight: this.fontSize * 1.4,
        fill: COLOURS.nodeText,
        wordWrap: false,
      },
      resolution: Math.max(window.devicePixelRatio, 2),
    });

    const contentWidth = Math.max(this.minWidth, titleText.width);
    const totalWidth = contentWidth + this.paddingX * 2;
    this.iconRow = new Container();

    let totalHeight: number;

    if (hasDescription) {
      const descText = new Text({
        text: description,
        style: {
          fontFamily: TYPOGRAPHY.fontFamily,
          fontSize: LAYOUT.descriptionFontSize,
          fontWeight: 'normal',
          lineHeight: LAYOUT.descriptionFontSize * 1.45,
          fill: COLOURS.nodeText,
          wordWrap: true,
          wordWrapWidth: contentWidth,
        },
        resolution: Math.max(window.devicePixelRatio, 2),
      });
      descText.alpha = 0.55;

      const descLineHeight = LAYOUT.descriptionFontSize * 1.45;
      const maxDescHeight = descLineHeight * LAYOUT.descriptionMaxLines;
      const descHeight = Math.min(descText.height, maxDescHeight);

      const innerHeight =
        titleText.height +
        LAYOUT.sectionGap +
        descHeight +
        LAYOUT.sectionGap +
        LAYOUT.iconRowHeight;

      totalHeight = innerHeight + this.paddingY * 2;
      const finalRadius =
        this.cornerRadius === -1 ? totalHeight / 2 : this.cornerRadius;

      this.bg.roundRect(0, 0, totalWidth, totalHeight, finalRadius);

      titleText.position.set(this.paddingX, this.paddingY);
      this.addChild(titleText);

      const descY = this.paddingY + titleText.height + LAYOUT.sectionGap;
      descText.position.set(this.paddingX, descY);
      if (descText.height > maxDescHeight) {
        const mask = new Graphics();
        mask.rect(this.paddingX, descY, contentWidth, maxDescHeight);
        mask.fill({ color: 0xffffff });
        this.addChild(mask);
        descText.mask = mask;
      }
      this.addChild(descText);

      const iconRowY =
        descY +
        descHeight +
        LAYOUT.sectionGap +
        (LAYOUT.iconRowHeight - LAYOUT.iconSize) / 2;
      this.iconRow.position.set(this.paddingX, iconRowY);
      this.addChild(this.iconRow);
    } else {
      totalHeight = titleText.height + this.paddingY * 2;
      const finalRadius =
        this.cornerRadius === -1 ? totalHeight / 2 : this.cornerRadius;
      this.bg.roundRect(0, 0, totalWidth, totalHeight, finalRadius);
      titleText.position.set(this.paddingX, this.paddingY);
      this.addChild(titleText);
      this.addChild(this.iconRow);
    }

    this.bg.fill({ color: COLOURS.nodeBg });

    const { color, width, alpha } = this.borderFor(state, onActivePath);
    this.bg.stroke({ color, width, alpha });

    this.pivot.set(0, totalHeight / 2);
    this.applyCompiledOpacity();
    this.borderWidth = this.bg.width;
    this.borderHeight = this.bg.height;
  }

  private borderFor(state: ActionState, onActivePath: boolean) {
    if (state === 'running') return { color: 0x3b82f6, width: 2, alpha: 1 };
    if (state === 'success' || state === 'compiled')
      return { color: 0x10b981, width: 2, alpha: 1 };
    if (state === 'failed') return { color: 0xef4444, width: 2, alpha: 1 };
    if (state === 'mixed')
      return { color: COLOURS.stateMixed, width: 2, alpha: 1 };
    if (state === 'compiling')
      return { color: 0xf59e0b, width: 2, alpha: 1 };
    if (onActivePath)
      return { color: 0xffffff, width: 1.5, alpha: 0.25 };
    return { color: COLOURS.nodeBorder, width: 1, alpha: 1 };
  }

  public setState(
    state: ActionState,
    onActivePath: boolean,
    isCompiled: boolean = this.isCompiledFlag,
  ): void {
    this.isCompiledFlag = isCompiled;
    const { color, width, alpha } = this.borderFor(state, onActivePath);

    this.bg.clear();
    this.bg.roundRect(0, 0, this.borderWidth, this.borderHeight, this.finalRadius);
    this.bg.fill({ color: COLOURS.nodeBg });
    this.bg.stroke({ color, width, alpha });

    this.applyCompiledOpacity();
  }

  private applyCompiledOpacity(): void {
    this.alpha = this.isCompiledFlag ? 1 : UNCOMPILED_NODE_OPACITY;
  }

  private get finalRadius(): number {
    return this.cornerRadius === -1 ? this.borderHeight / 2 : this.cornerRadius;
  }
}