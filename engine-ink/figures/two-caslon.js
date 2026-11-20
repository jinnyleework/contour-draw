import { driveUp } from "../src/figure.js";

/* two-caslon: traced from two-caslon.png by tools/trace.mjs (--dark 0.45 --mid 0.45 --size 700 --clean 0 --frame).
 * Dark areas are solid ink, middle tones are hatched, all in one ink. A still. Retrace rather than edit the masks. */
const twoCaslonArea = [-0.8500, 0.8500, -0.8500, 0.8500];
const TWO_CASLON_SOLID = { area: twoCaslonArea, mask: "jg.jg.44sv.k.iq.w.ig.14.i9.1a.i3.1g.hx.1l.ht.1p.hp.1t.hl.1x.hh.20.he.24.hb.26.h8.2a.h4.2d.h1.2g.gz.2i.gw.2l.gu.2n.gr.2q.gp.2s.gn.2u.gk.2x.gi.2y.gh.30.ge.33.gc.35.ga.36.g9.38.g6.3a.g5.3c.g3.3e.g1.3f.g0.3h.fy.3i.fx.3j.fw.3l.fu.3m.ft.14.d.26.fs.x.r.21.fq.t.z.1y.fp.q.16.1v.fo.o.1b.1u.fm.m.1h.1r.fl.l.1k.1q.fk.k.1o.1o.fj.j.1s.1n.fh.i.1v.1m.fg.i.1x.1l.fg.g.20.1k.ff.g.22.1j.fe.f.25.1i.fd.f.27.1i.fb.e.2a.1h.fa.e.2c.1g.fa.d.2e.1f.f9.d.2g.1e.f8.d.2h.1e.f7.d.2j.1d.f7.b.2m.1c.f6.b.2n.1c.f5.b.2p.1b.f4.b.2q.1b.f4.a.2s.1a.f3.a.2t.1a.f2.a.2v.19.f2.9.2w.19.f1.9.2y.18.f0.a.2y.18.f0.9.30.17.ez.9.31.17.ey.9.32.16.ez.8.34.15.ey.8.35.15.ex.9.35.15.ex.8.36.15.ew.8.38.14.ev.8.39.14.ev.8.39.13.ev.8.3a.13.ev.7.3c.12.eu.8.3c.12.et.8.3d.12.et.7.3e.11.eu.6.3f.11.ew.4.3g.10.ey.1.3h.10.ig.z.ih.z.ih.z.ih.y.ii.y.ii.y.ii.x.ij.x.ij.x.ij.w.ik.w.ik.v.il.v.il.u.im.u.il.v.il.u.im.u.im.t.in.s.io.s.in.s.io.s.io.r.ip.r.io.r.ip.r.ip.q.ip.r.ip.q.iq.p.iq.q.iq.p.ir.o.ir.p.ir.o.ir.o.is.o.ir.o.is.n.is.o.is.n.is.n.it.n.is.n.it.m.it.m.iu.m.it.m.iu.l.iu.l.iu.m.iu.l.iu.l.iu.l.iv.k.iv.k.iw.k.iv.k.iv.k.iw.j.iw.j.iw.j.iw.j.ix.i.ix.j.iw.j.ix.i.ix.i.ix.i.ix.i.iy.h.iy.h.iy.h.iy.h.iy.h.iz.g.iz.g.iz.g.iz.g.iz.g.j0.f.j0.f.j0.f.j0.f.j0.f.j0.f.j0.f.j0.f.j1.e.j1.e.j1.d.j2.d.j2.d.j2.d.36.3.ft.d.37.6.fp.d.37.6.fp.d.38.6.fo.d.38.7.fn.d.39.6.fn.d.39.7.fm.d.3a.6.fm.d.3a.7.fl.d.3b.7.fk.c.3c.7.fk.c.3d.7.fj.c.3d.8.fi.c.3d.8.fi.c.3d.9.fh.c.3d.a.fg.c.3d.a.fg.c.3d.b.ff.c.3d.b.ff.c.3d.c.fe.c.3d.d.fd.c.3c.e.fd.c.3b.g.fc.c.3a.i.fb.c.38.k.fb.b.37.n.fa.c.31.s.fa.46.f9.47.f7.48.f7.49.f6.4a.f5.4a.f5.4b.f4.4b.f4.4c.f3.4d.f2.4d.f2.4e.f0.4g.ez.4g.ez.4h.ey.4h.ey.4i.ex.4j.ew.4j.ev.4l.eu.4m.et.4m.et.4n.es.4n.es.4o.er.4p.eq.4p.ep.4r.eo.4s.en.4s.en.4t.em.4t.em.4u.ek.4w.ej.4w.ej.4x.ei.4y.eh.4y.eh.4z.ef.50.eg.50.eh.4z.eh.4y.ei.4y.2m6m" };

export const twoCaslon = {
  T: 4, active: [0, 1], S: 300, hint: "two caslon",
  drive: driveUp,
  shapes: [
    { id: "ink", ink: "black", bitmap: TWO_CASLON_SOLID },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
